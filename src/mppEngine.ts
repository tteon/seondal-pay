/**
 * mppEngine.ts — Machine Payments Protocol (MPP) compatibility layer
 *
 * Implements the Solana charge intent of the MPP specification
 * (paymentauth.org, draft-solana-charge-00) alongside the existing
 * legacy x402-style custom headers:
 *
 *   402 →  WWW-Authenticate: Payment id="...", realm="...", method="solana",
 *                            intent="charge", request="<base64url JCS JSON>",
 *                            expires="<RFC 3339>"
 *   pay →  Authorization: Payment <base64url JSON credential>
 *   ok  →  Payment-Receipt: <base64url JCS JSON receipt>
 *
 * Supported settlement: push mode only (client broadcasts the transaction
 * itself and presents the base58 signature). The charge request's
 * `externalId` MUST be embedded by the payer as an on-chain Memo
 * instruction, which the verifier uses to bind payment ↔ challenge.
 */

import crypto from 'crypto';
import bs58 from 'bs58';
import { paymentChallengeExpired } from './observability';

// Solana Memo program IDs (v1 & v2)
export const MEMO_PROGRAM_ID_V1 = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';
export const MEMO_PROGRAM_ID_V2 = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

const MEMO_PROGRAM_IDS = new Set([MEMO_PROGRAM_ID_V1, MEMO_PROGRAM_ID_V2]);

// ---------------------------------------------------------------------------
// base64url (RFC 4648 §5, no padding — MPP MUST NOT append '=' padding)
// ---------------------------------------------------------------------------
export function base64urlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// ---------------------------------------------------------------------------
// JCS — JSON Canonicalization Scheme (RFC 8785)
// Objects: keys sorted by UTF-16 code units (JS default sort), no whitespace.
// Numbers: ECMAScript Number::toString (JSON.stringify matches for finite).
// ---------------------------------------------------------------------------
export function jcsSerialize(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS: non-finite number is not allowed');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(jcsSerialize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + jcsSerialize(value[k])).join(',') + '}';
  }
  throw new Error(`JCS: unsupported type ${typeof value}`);
}

// ---------------------------------------------------------------------------
// Charge Request (MPP §7.1 / §7.2 — solana method)
// ---------------------------------------------------------------------------
export interface ChargeRequest {
  amount: string; // REQUIRED, base units decimal string (lamports for SOL)
  currency: string; // REQUIRED, "sol" (lowercase) or base58 SPL mint address
  recipient: string; // REQUIRED, base58 pubkey of the merchant
  externalId: string; // merchant reference — embedded on-chain as a Memo
  description?: string; // OPTIONAL, <= 256 chars
  methodDetails?: {
    network?: 'mainnet' | 'devnet' | 'localnet';
    [key: string]: any;
  };
}

export interface IssuedChallenge {
  id: string; // opaque challenge id (we reuse the legacy reference pubkey)
  realm: string;
  method: 'solana';
  intent: 'charge';
  requestB64: string; // base64url(JCS(chargeRequest))
  chargeRequest: ChargeRequest;
  expires: string; // RFC 3339
  expiresAtMs: number;
  createdAtMs: number;
  // Legacy interop (classic Solana Pay reference-key flow)
  tier: number;
  amountSol: number;
  legacyReference: string;
}

export interface IssueChallengeOptions {
  id: string; // challenge id — we pass the freshly generated reference pubkey
  recipient: string; // merchant base58 pubkey
  tier: number;
  amountSol: number;
  realm: string;
  description?: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = process.env.MPP_CHALLENGE_TTL_SECONDS
  ? parseInt(process.env.MPP_CHALLENGE_TTL_SECONDS)
  : 300;

// In-memory challenge store (single-process demo deployment)
const challenges = new Map<string, IssuedChallenge>();

export function issueChallenge(opts: IssueChallengeOptions): IssuedChallenge {
  const ttl = opts.ttlSeconds && opts.ttlSeconds > 0 ? opts.ttlSeconds : DEFAULT_TTL_SECONDS;
  const now = Date.now();
  const expiresAtMs = now + ttl * 1000;

  const chargeRequest: ChargeRequest = {
    amount: Math.round(opts.amountSol * 1e9).toString(),
    currency: 'sol',
    recipient: opts.recipient,
    externalId: `SEOCHO-${now}-${crypto.randomBytes(6).toString('hex')}`,
    description: (opts.description || `Tier ${opts.tier} data provision`).slice(0, 256),
    methodDetails: {
      network: (process.env.MPP_SOLANA_NETWORK as 'mainnet' | 'devnet' | 'localnet') || 'devnet',
    },
  };

  const challenge: IssuedChallenge = {
    id: opts.id,
    realm: opts.realm,
    method: 'solana',
    intent: 'charge',
    requestB64: base64urlEncode(jcsSerialize(chargeRequest)),
    chargeRequest,
    expires: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
    createdAtMs: now,
    tier: opts.tier,
    amountSol: opts.amountSol,
    legacyReference: opts.id,
  };

  challenges.set(challenge.id, challenge);
  return challenge;
}

/**
 * Look up a challenge. Returns undefined when unknown OR expired
 * (expired entries are evicted on access).
 */
export function getChallenge(id: string): IssuedChallenge | undefined {
  const ch = challenges.get(id);
  if (!ch) return undefined;
  if (Date.now() > ch.expiresAtMs) {
    challenges.delete(id);
    paymentChallengeExpired.inc();
    return undefined;
  }
  return ch;
}

/** Check-and-consume in one step (MPP §10.5 replay protection). */
export function consumeChallenge(id: string): boolean {
  return challenges.delete(id);
}

export function activeChallengeCount(): number {
  return challenges.size;
}

// Lazy eviction happens on getChallenge; this interval keeps the map tidy.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [id, ch] of challenges) {
    if (now > ch.expiresAtMs) challenges.delete(id);
  }
}, 60_000);
sweep.unref?.();

// ---------------------------------------------------------------------------
// WWW-Authenticate header (server side) + parser (client side)
// ---------------------------------------------------------------------------
export function buildWwwAuthenticateHeader(ch: IssuedChallenge): string {
  return (
    `Payment id="${ch.id}", realm="${ch.realm}", method="solana", ` +
    `intent="charge", request="${ch.requestB64}", expires="${ch.expires}"`
  );
}

/** Parse `WWW-Authenticate: Payment k="v", ...` params. Null if not Payment. */
export function parseWwwAuthenticate(header: string): Record<string, string> | null {
  if (!header || !/^Payment\s+/i.test(header.trim())) return null;
  const rest = header.trim().replace(/^Payment\s+/i, '');
  const params: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    params[m[1]] = m[2];
  }
  return params.id && params.request ? params : null;
}

export function decodeChargeRequest(requestB64: string): ChargeRequest {
  return JSON.parse(base64urlDecode(requestB64).toString('utf-8'));
}

// ---------------------------------------------------------------------------
// Authorization: Payment credential (client builds / server parses)
// ---------------------------------------------------------------------------
export interface PaymentCredential {
  challenge: {
    id: string;
    realm?: string;
    method?: string;
    intent?: string;
    request?: string;
    expires?: string;
  };
  source?: string; // payer base58 pubkey (optional per spec)
  payload: {
    type: 'signature' | 'transaction';
    signature?: string; // push mode: base58 on-chain tx signature
    transaction?: string; // pull mode: base64 signed tx (not supported here)
  };
}

/** Client-side: build the Authorization header value. */
export function buildPaymentCredential(
  challengeParams: Record<string, string>,
  payerPubkey: string,
  signature: string
): string {
  const credential: PaymentCredential = {
    challenge: {
      id: challengeParams.id,
      realm: challengeParams.realm,
      method: challengeParams.method || 'solana',
      intent: challengeParams.intent || 'charge',
      request: challengeParams.request,
      expires: challengeParams.expires,
    },
    source: payerPubkey,
    payload: { type: 'signature', signature },
  };
  return `Payment ${base64urlEncode(jcsSerialize(credential))}`;
}

/** Server-side: parse an Authorization header into a credential, or null. */
export function parsePaymentCredential(header: string): PaymentCredential | null {
  if (!header || !/^Payment\s+/i.test(header.trim())) return null;
  const token = header.trim().replace(/^Payment\s+/i, '');
  try {
    const parsed = JSON.parse(base64urlDecode(token).toString('utf-8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.challenge || !parsed.payload) return null;
    return parsed as PaymentCredential;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payment-Receipt (MPP §11.6)
// ---------------------------------------------------------------------------
export function buildPaymentReceipt(ch: IssuedChallenge, signature: string): string {
  return base64urlEncode(
    jcsSerialize({
      method: 'solana',
      challengeId: ch.id,
      reference: signature, // the on-chain tx signature
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  );
}

// ---------------------------------------------------------------------------
// Memo extraction helpers (shared by mock RPC path and devnet path)
// ---------------------------------------------------------------------------
export function isMemoProgramId(programIdBase58: string): boolean {
  return MEMO_PROGRAM_IDS.has(programIdBase58);
}

/** Extract UTF-8 memo strings from a live getTransaction response message. */
export function extractMemosFromCompiledMessage(
  accountKeys: { toBase58(): string }[],
  instructions: any[]
): string[] {
  const memos: string[] = [];
  for (const ix of instructions || []) {
    const key = accountKeys[ix.programIdIndex];
    if (!key) continue;
    if (isMemoProgramId(key.toBase58())) {
      try {
        // Compiled instruction data arrives base58-encoded over JSON RPC.
        memos.push(Buffer.from(bs58.decode(ix.data)).toString('utf-8'));
      } catch {
        /* ignore undecodable memo */
      }
    }
  }
  return memos;
}
