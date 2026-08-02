/**
 * test_mpp_flow.ts — End-to-end test of the MPP (draft-solana-charge-00)
 * payment layer against a locally running server in Mock Sandbox mode.
 *
 * Flows:
 *   A. Happy path: 402 challenge → mock tx (transfer + memo) → credential → 200 + receipt
 *   B. Replay: consumed signature against a fresh challenge → 402 verification-failed
 *   C. Tamper: modified challenge echo → 402 invalid-challenge
 *   D. Expiry: pay after TTL → 402 invalid-challenge
 *   E. Legacy: x-payment-* headers only (reference key, no memo) → 200
 *
 * Usage: npx ts-node scripts/test_mpp_flow.ts
 * (server must be running: PORT=3000 MPP_CHALLENGE_TTL_SECONDS=6 npx ts-node src/server.ts)
 */
import axios from 'axios';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import {
  parseWwwAuthenticate,
  decodeChargeRequest,
  buildPaymentCredential,
  base64urlDecode,
  MEMO_PROGRAM_ID_V2
} from '../src/mppEngine';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SCRAPE_URL = `${BASE}/api/scrape`;
const MOCK_RPC = `${BASE}/api/mock-rpc/send-transaction`;
const TEST_ITEM_URL = 'https://www.aliexpress.com/item/1005006240212345.html';

const payer = Keypair.generate();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    console.log(`  ❌ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '');
    failures++;
  }
}

async function requestChallenge(tier = 3) {
  return axios.post(
    SCRAPE_URL,
    { url: TEST_ITEM_URL, requestedTier: tier },
    { validateStatus: () => true }
  );
}

async function payMock(recipient: string, amountSol: number, reference: string, externalId?: string) {
  const tx = new Transaction();
  const transfer = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(recipient),
    lamports: Math.round(amountSol * 1e9)
  });
  transfer.keys.push({ pubkey: new PublicKey(reference), isSigner: false, isWritable: false });
  tx.add(transfer);
  if (externalId) {
    tx.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(MEMO_PROGRAM_ID_V2),
        data: Buffer.from(externalId, 'utf-8')
      })
    );
  }
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = '4uQvQbGt5i2GsiSnh2Et4by7G4g5A8t1929312389128';
  tx.sign(payer);
  const transactionB64 = Buffer.from(tx.serialize()).toString('base64');
  const r = await axios.post(MOCK_RPC, { transactionB64 });
  return r.data.signature as string;
}

function mppHeaders(params: Record<string, string>, signature: string) {
  return { Authorization: buildPaymentCredential(params, payer.publicKey.toBase58(), signature) };
}

async function main() {
  console.log('=== Flow A: MPP happy path ===');
  const chA = await requestChallenge(3);
  check('A1: 402 returned', chA.status === 402, chA.status);
  const pA = parseWwwAuthenticate(chA.headers['www-authenticate'] || '');
  check('A2: WWW-Authenticate Payment header present', !!pA);
  const crA = pA ? decodeChargeRequest(pA.request) : null;
  check(
    'A3: charge request = lamports string + currency sol + externalId',
    !!crA && /^\d+$/.test(crA.amount) && crA.currency === 'sol' && !!crA.externalId,
    crA
  );
  const sigA = await payMock(chA.data.recipient, chA.data.amount, chA.data.reference, crA!.externalId);
  const resA = await axios.post(
    SCRAPE_URL,
    { url: TEST_ITEM_URL, requestedTier: 3 },
    { headers: mppHeaders(pA!, sigA), validateStatus: () => true }
  );
  check('A4: 200 after MPP payment', resA.status === 200, resA.data);
  const receiptA = resA.headers['payment-receipt'];
  check('A5: Payment-Receipt header present', !!receiptA);
  if (receiptA) {
    const decoded = JSON.parse(base64urlDecode(receiptA).toString('utf-8'));
    check(
      'A6: receipt has challengeId + reference=signature + status=success',
      decoded.reference === sigA && decoded.status === 'success' && decoded.challengeId === pA!.id,
      decoded
    );
  }
  check('A7: protocol labelled MPP push mode', (resA.data?.payment?.protocol || '').includes('MPP'), resA.data?.payment);

  console.log('\n=== Flow B: signature replay against fresh challenge → rejected ===');
  const chB = await requestChallenge(3);
  const pB = parseWwwAuthenticate(chB.headers['www-authenticate'] || '')!;
  const resB = await axios.post(
    SCRAPE_URL,
    { url: TEST_ITEM_URL, requestedTier: 3 },
    { headers: mppHeaders(pB, sigA), validateStatus: () => true } // sigA already consumed
  );
  check(
    'B1: 402 with application/problem+json',
    resB.status === 402 && String(resB.headers['content-type'] || '').includes('application/problem+json'),
    { status: resB.status, ct: resB.headers['content-type'] }
  );
  check('B2: verification-failed type', (resB.data?.type || '').includes('verification-failed'), resB.data);
  check('B3: fresh challenge re-issued on error', !!parseWwwAuthenticate(resB.headers['www-authenticate'] || ''));

  console.log('\n=== Flow C: tampered challenge echo → rejected ===');
  const chC = await requestChallenge(3);
  const pC = parseWwwAuthenticate(chC.headers['www-authenticate'] || '')!;
  const tampered = {
    ...pC,
    request: pC.request.slice(0, -2) + (pC.request.endsWith('AA') ? 'BB' : 'AA')
  };
  const sigC = await payMock(
    chC.data.recipient,
    chC.data.amount,
    chC.data.reference,
    decodeChargeRequest(pC.request).externalId
  );
  const resC = await axios.post(
    SCRAPE_URL,
    { url: TEST_ITEM_URL, requestedTier: 3 },
    { headers: mppHeaders(tampered, sigC), validateStatus: () => true }
  );
  check(
    'C1: 402 invalid-challenge (mismatch)',
    resC.status === 402 && (resC.data?.type || '').includes('invalid-challenge'),
    resC.data
  );

  console.log('\n=== Flow D: expired challenge → rejected ===');
  const chD = await requestChallenge(3);
  const pD = parseWwwAuthenticate(chD.headers['www-authenticate'] || '')!;
  const crD = decodeChargeRequest(pD.request);
  const waitSec = parseInt(process.env.TEST_TTL_WAIT || '7');
  console.log(`  (sleeping ${waitSec}s to pass TTL...)`);
  await sleep(waitSec * 1000);
  const sigD = await payMock(chD.data.recipient, chD.data.amount, chD.data.reference, crD.externalId);
  const resD = await axios.post(
    SCRAPE_URL,
    { url: TEST_ITEM_URL, requestedTier: 3 },
    { headers: mppHeaders(pD, sigD), validateStatus: () => true }
  );
  check(
    'D1: 402 invalid-challenge (expired)',
    resD.status === 402 && (resD.data?.type || '').includes('invalid-challenge'),
    resD.data
  );

  console.log('\n=== Flow E: legacy x-payment-* headers still work ===');
  const chE = await requestChallenge(3);
  const sigE = await payMock(chE.data.recipient, chE.data.amount, chE.data.reference); // no memo
  const resE = await axios.post(
    SCRAPE_URL,
    { url: TEST_ITEM_URL, requestedTier: 3 },
    {
      headers: { 'x-payment-signature': sigE, 'x-payment-reference': chE.data.reference },
      validateStatus: () => true
    }
  );
  check('E1: 200 via legacy headers', resE.status === 200, resA.data ? undefined : resE.data);
  check('E2: legacy flow also receives Payment-Receipt', !!resE.headers['payment-receipt']);

  console.log(`\n${failures === 0 ? '🎉 ALL FLOWS PASSED' : `⚠️  ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Test crashed:', e.message);
  process.exit(1);
});
