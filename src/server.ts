import 'dotenv/config';
import './observability';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction 
} from '@solana/web3.js';
import { scrapeProduct } from './scraper';
import { initDb, queryProducts, searchProductsByJsonLd } from './db';
import { reserveSupplierOrder } from './orderWebhook';
import { executeMultiModelEnsemble } from './multiModelOrchestrator';
import { evaluateBenchmark1And3 } from './benchmark1and3Engine';
import { getPersonalizedSourcingFeed } from './personalizedSourcingEngine';
import { generateBeginnerConsultation, BEGINNER_PAIN_POINTS } from './beginnerConsultant';
import { createPayShChallenge, verifyPayShTransaction } from './payShEngine';
import { searchA2AOntologyGraph } from './productOntologyGraph';
import { executeFullPersonalizedOntologyBinding } from './fullPersonalizedOntologyGraph';
import { generate100CategoriesDataset } from './dataset100CategoriesEngine';
import { runMultiPlatformKimiVsGptBenchmark } from './multiPlatformBenchmarker';
import { runEmpiricalOntologyBenchmarkExperiment } from './empiricalOntologyExperiment';
import {
  issueChallenge,
  getChallenge,
  consumeChallenge,
  activeChallengeCount,
  buildWwwAuthenticateHeader,
  parsePaymentCredential,
  buildPaymentReceipt,
  isMemoProgramId,
  extractMemosFromCompiledMessage,
  IssuedChallenge
} from './mppEngine';
import {
  tracer,
  logEvent,
  metricsRegistry,
  httpMetricsMiddleware,
  paymentChallengesIssued,
  paymentVerifications,
  paymentReplayRejections,
  activeChallengesGauge,
  paymentRevenueSol,
  SERVICE_VERSION
} from './observability';
import { alertHighValueSourcing, extractRoiSignals } from './discordAlerter';
import { compareProduct, runComparatorSweep, getLatestSnapshots, getMarginCurve, startComparatorLoop } from './comparatorEngine';
import { routeOpportunity, listProfiles } from './interestProfileEngine';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
// Using Solana Devnet RPC
const RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Path to store merchant keypair so it persists between restarts
const KEYPAIR_PATH = path.join(__dirname, '../merchant-keypair.json');

// Load or generate Merchant Keypair
let merchantKeypair: Keypair;
if (fs.existsSync(KEYPAIR_PATH)) {
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8')));
  merchantKeypair = Keypair.fromSecretKey(secretKey);
} else {
  merchantKeypair = Keypair.generate();
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(merchantKeypair.secretKey)), 'utf-8');
}

const merchantPublicKey = merchantKeypair.publicKey;
console.log(`==================================================`);
console.log(`Merchant (Agent B) Public Key: ${merchantPublicKey.toBase58()}`);
console.log(`==================================================`);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(httpMetricsMiddleware);

// Prometheus scrape endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// Kubernetes liveness/readiness probe endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'seondal-pay',
    version: SERVICE_VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// In-Memory Active Auth Sessions
const activeSessions = new Set<string>();

/**
 * Account Credentials & RBAC Registry
 */
const USER_REGISTRY: Record<string, { passwordHash: string; role: string; wallet: string }> = {
  'admin': {
    passwordHash: 'admin',
    role: 'ADMIN',
    wallet: 'De6su1LcyGUmekuK2AGmGDnCwZSbeSfWoK33JFnwSkyF'
  },
  'hadry.seller@seocho.io': {
    passwordHash: 'admin',
    role: 'SELLER_PRO',
    wallet: 'De6su1LcyGUmekuK2AGmGDnCwZSbeSfWoK33JFnwSkyF'
  }
};

/**
 * Fail-Safe Authentication Endpoint (admin / admin or any seller email)
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const targetUser = username || 'admin';

  // Permissive fallback: allow admin/admin or any input for seamless onboarding
  const role = targetUser === 'admin' ? 'ADMIN' : 'SELLER_PRO';
  const wallet = 'De6su1LcyGUmekuK2AGmGDnCwZSbeSfWoK33JFnwSkyF';
  const sessionToken = `SEOCHO-SESSION-${role}-${Date.now()}`;

  activeSessions.add(sessionToken);
  console.log(`[Auth Success] Authenticated user '${targetUser}' with role '${role}'!`);

  return res.status(200).json({
    status: 'success',
    token: sessionToken,
    user: {
      username: targetUser,
      role: role,
      wallet: wallet,
      permissions: ['ALL_ACCESS', 'DATASET_WRITE', 'SOL_PAYMENT', 'ANALYTICS']
    }
  });
});

// Serve static files for the frontend dashboard
const publicPath = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../src/public');
app.use(express.static(publicPath));

// Map the local mock GCS files in development so they serve directly in the web dashboard
const mockStoragePath = path.join(__dirname, '../local_gcp_mock/storage/solana-paysh-scraped-data/products');
const mockStoragePathAlt = path.join(__dirname, 'local_gcp_mock/storage/solana-paysh-scraped-data/products');
const resolvedStoragePath = fs.existsSync(mockStoragePathAlt) ? mockStoragePathAlt : mockStoragePath;
app.use('/products', express.static(resolvedStoragePath));

// Tiered payload filter
function filterPayloadByTier(dataJsonLd: any, purchasedTier: number) {
  if (!dataJsonLd) return null;
  if (purchasedTier >= 3) return dataJsonLd;

  const allowedKeys = {
    1: ['@context', '@type', '@id', 'name', 'description', 'image', 'url', 'brand'],
    2: ['@context', '@type', '@id', 'name', 'description', 'image', 'url', 'brand', 'offers', 'additionalProperty']
  };

  const keys = allowedKeys[purchasedTier as 1 | 2] || allowedKeys[1];
  const filtered: any = {};
  
  keys.forEach(k => {
    if (dataJsonLd[k] !== undefined) {
      if (k === 'additionalProperty' && purchasedTier === 2) {
        // Filter out Korean competitor price & ROI summary in Tier 2
        filtered[k] = dataJsonLd[k].filter((prop: any) => 
          prop.name !== 'Korean Benchmark Retail Price' && prop.name !== 'Estimated ROI Margin'
        );
      } else {
        filtered[k] = dataJsonLd[k];
      }
    }
  });

  return filtered;
}

// Get all products from the database
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const products = await queryProducts();
    return res.status(200).json(products);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: error.message });
  }
});

import { executeA2APipeline } from './a2aPipeline';
import { apiGatewayMiddleware, generateApiKey, getGatewayAnalytics, recordGatewayRevenue } from './apiGateway';

// Mount API Gateway Middleware on Agent APIs
app.use('/api/agent', apiGatewayMiddleware);
app.use('/api/scrape', apiGatewayMiddleware);

// API Gateway Key Management Endpoint
app.post('/api/gateway/keys', (req: Request, res: Response) => {
  const { clientAgentId, initialTier } = req.body;
  const keyRecord = generateApiKey(clientAgentId || 'External_Buyer_Agent', initialTier || 1);
  return res.status(201).json({
    message: 'API Key generated successfully',
    keyRecord
  });
});

// API Gateway Analytics & SOL Revenue Metrics Endpoint
app.get('/api/gateway/analytics', (req: Request, res: Response) => {
  return res.status(200).json(getGatewayAnalytics());
});

// 5-Step A2A Multi-Agent Query Endpoint (Gemini <-> MARA Cloud Agent)
app.post('/api/agent/query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing "query" parameter in request body.'
      });
    }

    const result = await executeA2APipeline(query);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error executing A2A agent query:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Semantic JSON-LD Search Endpoint
app.get('/api/products/search', async (req: Request, res: Response) => {
  try {
    const moqMax = req.query.moq_max ? parseInt(req.query.moq_max as string) : undefined;
    const weightMax = req.query.weight_max ? parseInt(req.query.weight_max as string) : undefined;
    
    const results = await searchProductsByJsonLd({ moqMax, weightMax });
    return res.status(200).json({
      query: { moqMax, weightMax },
      count: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error searching products:', error);
    return res.status(500).json({ error: error.message });
  }
});

// In-memory store for processed signatures and mock transactions.
// Pending payment challenges live in mppEngine's TTL-enforcing store,
// keyed by challenge id (which doubles as the legacy reference pubkey).
const processedSignatures = new Set<string>();
const mockTransactions = new Map<string, any>();

// Realm advertised in WWW-Authenticate Payment challenges
const MPP_REALM = process.env.MPP_REALM || 'seocho-pay';

// Endpoint to retrieve server status, configuration, and logs for the dashboard
app.get('/api/status', (req: Request, res: Response) => {
  return res.json({
    merchantPublicKey: merchantPublicKey.toBase58(),
    pendingCount: activeChallengeCount(),
    processedCount: processedSignatures.size,
    processedSignatures: Array.from(processedSignatures),
    mockTransactions: Array.from(mockTransactions.entries()).map(([sig, tx]) => {
      let amount = 0.01;
      try {
        const recipientIndex = tx.transaction.message.accountKeys.findIndex(
          (key: any) => key.toString() === merchantPublicKey.toBase58()
        );
        if (recipientIndex !== -1 && tx.meta) {
          amount = (tx.meta.postBalances[recipientIndex] - tx.meta.preBalances[recipientIndex]) / 1e9;
        }
      } catch (e) {}
      return {
        signature: sig,
        amount: amount,
        recipient: merchantPublicKey.toBase58(),
        slot: tx.slot,
        timestamp: Date.now()
      };
    })
  });
});

// Shared post-fulfillment: margin snapshot → interest-profile routing → Discord.
function dispatchSourcingAlert(
  scrapedProduct: any,
  tier: number,
  amountSol: number,
  signature: string,
  paymentMode: string
) {
  const snapshot = compareProduct(scrapedProduct);
  const matches = snapshot
    ? routeOpportunity({
        productId: snapshot.productId,
        title: snapshot.title,
        category: scrapedProduct.dataJsonLd?.category,
        roiPercent: snapshot.roiPercent,
        marginKrw: snapshot.marginKrw,
      })
    : [];

  alertHighValueSourcing({
    productId: scrapedProduct.productId,
    title: scrapedProduct.title,
    priceUsd: scrapedProduct.price,
    ...extractRoiSignals(scrapedProduct.dataJsonLd),
    tier,
    amountSol,
    signature,
    paymentMode,
    matchedProfiles: matches.map((m) => ({ displayName: m.profile.displayName, score: m.score })),
  }).catch(() => { /* alerting must never break fulfillment */ });
}

// Paid API Endpoint: Scrapes AliExpress/1688 details (HTTP 402 Flow)
// Accepts BOTH the standard MPP credential (Authorization: Payment ...) and
// the legacy custom headers (x-payment-signature / x-payment-reference).
app.post('/api/scrape', async (req: Request, res: Response) => {
  const { url, requestedTier } = req.body;
  const tier = requestedTier ? parseInt(requestedTier) : 3;

  if (!url) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing "url" parameter in request body.'
    });
  }

  // --- Standard path: MPP (draft-solana-charge-00) credential ---
  const authHeader = req.headers['authorization'] as string | undefined;
  if (authHeader && /^Payment\s+/i.test(authHeader.trim())) {
    return handleMppPaidRequest(req, res, authHeader, url, tier);
  }

  // --- Legacy path: custom x-payment-* headers ---
  const signature = req.headers['x-payment-signature'] as string;
  const referenceStr = req.headers['x-payment-reference'] as string;

  // Case 1: No payment proof provided
  if (!signature || !referenceStr) {
    return sendPaymentChallenge(res, tier);
  }

  // Prevent double-spending of the same signature
  if (processedSignatures.has(signature)) {
    paymentReplayRejections.inc({ protocol: 'legacy' });
    logEvent('warn', 'payment.replay_rejected', { protocol: 'legacy', signature });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'This payment signature has already been used.'
    });
  }

  // Get the details of the challenge we generated (TTL-enforced lookup)
  const pending = getChallenge(referenceStr);
  if (!pending) {
    logEvent('warn', 'payment.challenge_invalid', { protocol: 'legacy', reference: referenceStr });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid or expired payment reference.'
    });
  }

  console.log(`[Agent B] Verifying payment signature: ${signature} for reference: ${referenceStr} (Tier ${pending.tier})...`);

  try {
    const reference = new PublicKey(referenceStr);

    // Verify transaction (checks mock store first, then falls back to Devnet)
    const isValid = await verifyPayment(signature, merchantPublicKey, pending.amountSol, {
      legacyReference: reference,
      externalId: pending.chargeRequest.externalId
    });

    if (isValid) {
      // Mark as processed
      processedSignatures.add(signature);
      consumeChallenge(referenceStr);
      activeChallengesGauge.set(activeChallengeCount());

      const apiKey = (req as any).gatewayContext?.apiKey || 'default_key';
      recordGatewayRevenue(apiKey, pending.tier, pending.amountSol);
      paymentVerifications.inc({ protocol: 'legacy', result: 'success', reason: 'ok' });
      paymentRevenueSol.inc({ tier: String(pending.tier) }, pending.amountSol);
      logEvent('info', 'payment.verified', {
        protocol: 'legacy',
        tier: pending.tier,
        amountSol: pending.amountSol,
        signature,
        mode: mockTransactions.has(signature) ? 'mock' : 'devnet'
      });

      console.log(`[Agent B] Payment verified successfully! Executing e-commerce scraping...`);

      // Execute the scraper engine (saves to database and GCS automatically)
      const scrapedProduct = await scrapeProduct(url);

      // Post-fulfillment: comparator + profile routing + Discord (fire-and-forget)
      dispatchSourcingAlert(
        scrapedProduct, pending.tier, pending.amountSol, signature,
        mockTransactions.has(signature) ? 'Mock Sandbox' : 'Solana Devnet'
      );

      // Filter payload by purchased Tier
      const filteredDataJsonLd = filterPayloadByTier(scrapedProduct.dataJsonLd, pending.tier);

      res.setHeader('Payment-Receipt', buildPaymentReceipt(pending, signature));

      return res.status(200).json({
        status: 'success',
        message: `Successfully scraped product after verified Tier ${pending.tier} payment.`,
        purchasedTier: pending.tier,
        payment: {
          signature,
          amountSol: pending.amountSol,
          mode: mockTransactions.has(signature) ? 'Mock Sandbox' : 'Solana Devnet',
          protocol: 'legacy x-payment-* headers'
        },
        data: {
          ...scrapedProduct,
          dataJsonLd: filteredDataJsonLd
        }
      });
    } else {
      console.log(`[Agent B] Payment verification failed for signature: ${signature}`);
      paymentVerifications.inc({ protocol: 'legacy', result: 'failed', reason: 'onchain_check_failed' });
      logEvent('warn', 'payment.verification_failed', { protocol: 'legacy', signature, reason: 'onchain_check_failed' });
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Payment verification failed. Ensure the transaction is confirmed and correct.'
      });
    }
  } catch (error: any) {
    console.error('[Agent B] Error during verification:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * Standard MPP flow (draft-solana-charge-00, push mode):
 * client presents `Authorization: Payment <credential>` with payload
 * type="signature" after broadcasting the transfer + Memo(externalId) itself.
 */
async function handleMppPaidRequest(
  req: Request,
  res: Response,
  authHeader: string,
  url: string,
  tier: number
) {
  // 1. Decode credential
  const credential = parsePaymentCredential(authHeader);
  if (!credential) {
    return sendMppProblem(res, tier, 'malformed-credential', 'Malformed Credential',
      'The Authorization header could not be decoded as a base64url Payment credential.');
  }

  // 2. Challenge lookup (unknown or expired → fresh challenge)
  const echo = credential.challenge || {};
  const stored = echo.id ? getChallenge(echo.id) : undefined;
  if (!stored) {
    logEvent('warn', 'payment.challenge_invalid', { protocol: 'mpp', challengeId: echo.id });
    return sendMppProblem(res, tier, 'invalid-challenge', 'Invalid or Expired Challenge',
      'The referenced challenge is unknown or expired. A fresh challenge is provided.');
  }

  // 3. Echo integrity: the client must echo the exact request it was issued
  if (echo.request && echo.request !== stored.requestB64) {
    logEvent('warn', 'payment.challenge_mismatch', { protocol: 'mpp', challengeId: echo.id });
    return sendMppProblem(res, tier, 'invalid-challenge', 'Challenge Mismatch',
      'The echoed charge request does not match the issued challenge.');
  }

  // 4. Push mode only: payload must be a broadcasted signature
  if (credential.payload?.type !== 'signature' || !credential.payload.signature) {
    return sendMppProblem(res, tier, 'malformed-credential', 'Unsupported Payload',
      'This server supports push mode only: payload type must be "signature".');
  }
  const signature = credential.payload.signature;

  // 5. Replay protection (MPP §10.5: consumed signatures are rejected globally)
  if (processedSignatures.has(signature)) {
    paymentReplayRejections.inc({ protocol: 'mpp' });
    logEvent('warn', 'payment.replay_rejected', { protocol: 'mpp', signature, challengeId: stored.id });
    return sendMppProblem(res, tier, 'verification-failed', 'Payment Already Consumed',
      'This transaction signature has already been used.');
  }

  console.log(`[Agent B][MPP] Verifying push-mode signature ${signature} for challenge ${stored.id} (externalId: ${stored.chargeRequest.externalId})...`);

  try {
    // 6. On-chain verification: amount + recipient + Memo(externalId) binding
    const isValid = await verifyPayment(signature, merchantPublicKey, stored.amountSol, {
      legacyReference: new PublicKey(stored.legacyReference),
      externalId: stored.chargeRequest.externalId
    });

    if (!isValid) {
      paymentVerifications.inc({ protocol: 'mpp', result: 'failed', reason: 'onchain_check_failed' });
      logEvent('warn', 'payment.verification_failed', {
        protocol: 'mpp', signature, challengeId: stored.id, reason: 'onchain_check_failed'
      });
      return sendMppProblem(res, tier, 'verification-failed', 'Payment Verification Failed',
        'On-chain transaction did not satisfy the charge request (amount, recipient, or memo binding).');
    }

    // 7. Consume signature + challenge atomically before serving
    processedSignatures.add(signature);
    consumeChallenge(stored.id);
    activeChallengesGauge.set(activeChallengeCount());

    const apiKey = (req as any).gatewayContext?.apiKey || 'default_key';
    recordGatewayRevenue(apiKey, stored.tier, stored.amountSol);
    paymentVerifications.inc({ protocol: 'mpp', result: 'success', reason: 'ok' });
    paymentRevenueSol.inc({ tier: String(stored.tier) }, stored.amountSol);
    logEvent('info', 'payment.verified', {
      protocol: 'mpp',
      tier: stored.tier,
      amountSol: stored.amountSol,
      signature,
      payer: credential.source || null,
      externalId: stored.chargeRequest.externalId,
      mode: mockTransactions.has(signature) ? 'mock' : 'devnet'
    });

    console.log(`[Agent B][MPP] Payment verified! Executing e-commerce scraping...`);

    const scrapedProduct = await scrapeProduct(url);

    // Post-fulfillment: comparator + profile routing + Discord (fire-and-forget)
    dispatchSourcingAlert(
      scrapedProduct, stored.tier, stored.amountSol, signature,
      mockTransactions.has(signature) ? 'Mock Sandbox' : 'Solana Devnet'
    );

    const filteredDataJsonLd = filterPayloadByTier(scrapedProduct.dataJsonLd, stored.tier);

    // MPP §11.6 receipt
    res.setHeader('Payment-Receipt', buildPaymentReceipt(stored, signature));

    return res.status(200).json({
      status: 'success',
      message: `Successfully scraped product after verified MPP Tier ${stored.tier} payment.`,
      purchasedTier: stored.tier,
      payment: {
        signature,
        amountSol: stored.amountSol,
        mode: mockTransactions.has(signature) ? 'Mock Sandbox' : 'Solana Devnet',
        protocol: 'MPP draft-solana-charge-00 (push mode)',
        payer: credential.source || null,
        externalId: stored.chargeRequest.externalId
      },
      data: {
        ...scrapedProduct,
        dataJsonLd: filteredDataJsonLd
      }
    });
  } catch (error: any) {
    console.error('[Agent B][MPP] Error during verification:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

// Issue a fresh challenge and set BOTH the standard WWW-Authenticate header
// and the legacy X-Payment-* headers. Returns the challenge for body building.
function attachChallengeHeaders(res: Response, tier: number): IssuedChallenge {
  const referenceKeypair = Keypair.generate();
  const referenceStr = referenceKeypair.publicKey.toBase58();

  // Tier pricing in SOL
  const tierPrices: Record<number, number> = {
    1: 0.005, // Tier 1: Basic metadata
    2: 0.015, // Tier 2: Logistics & wholesale
    3: 0.050  // Tier 3: Market ROI & Competitor benchmark
  };
  const amount = tierPrices[tier] || 0.050;

  const challenge = issueChallenge({
    id: referenceStr,
    recipient: merchantPublicKey.toBase58(),
    tier,
    amountSol: amount,
    realm: MPP_REALM,
    description: `Tier ${tier} e-commerce product data provision`
  });

  console.log(`[Agent B] Issued Tier ${tier} 402 challenge. Reference: ${referenceStr}, Amount: ${amount} SOL, expires: ${challenge.expires}, externalId: ${challenge.chargeRequest.externalId}`);
  paymentChallengesIssued.inc({ tier: String(tier) });
  activeChallengesGauge.set(activeChallengeCount());
  logEvent('info', 'payment.challenge_issued', {
    tier,
    amountSol: amount,
    challengeId: challenge.id,
    expires: challenge.expires,
    externalId: challenge.chargeRequest.externalId
  });

  // Standard MPP challenge header (draft-solana-charge-00)
  res.setHeader('WWW-Authenticate', buildWwwAuthenticateHeader(challenge));

  // Legacy headers for the x402 / pay.sh style clients
  res.setHeader('X-Payment-Recipient', merchantPublicKey.toBase58());
  res.setHeader('X-Payment-Amount', amount.toString());
  res.setHeader('X-Payment-Reference', referenceStr);
  res.setHeader('X-Payment-Redirect', `solana:${merchantPublicKey.toBase58()}?amount=${amount}&reference=${referenceStr}`);

  return challenge;
}

// Helper function to issue a 402 challenge with dynamic pricing based on Tier
function sendPaymentChallenge(res: Response, tier: number = 3) {
  const challenge = attachChallengeHeaders(res, tier);
  const amount = challenge.amountSol;
  const referenceStr = challenge.legacyReference;

  return res.status(402).json({
    error: 'Payment Required',
    tier: tier,
    recipient: merchantPublicKey.toBase58(),
    amount: amount,
    reference: referenceStr,
    message: `Payment of ${amount} SOL required for Tier ${tier} data provision. Please transfer to ${merchantPublicKey.toBase58()} containing reference key ${referenceStr}`,
    mpp: {
      method: 'solana',
      intent: 'charge',
      request: challenge.requestB64,
      chargeRequest: challenge.chargeRequest,
      expires: challenge.expires
    }
  });
}

// RFC 9457 problem-details error, always paired with a fresh challenge (MPP §12)
function sendMppProblem(res: Response, tier: number, type: string, title: string, detail: string) {
  const challenge = attachChallengeHeaders(res, tier);
  res.setHeader('Content-Type', 'application/problem+json');
  return res.status(402).json({
    type: `https://paymentauth.org/problems/${type}`,
    title,
    status: 402,
    detail,
    mpp: {
      method: 'solana',
      intent: 'charge',
      request: challenge.requestB64,
      chargeRequest: challenge.chargeRequest,
      expires: challenge.expires
    }
  });
}

// Mock RPC Endpoint to submit transactions when running in offline/sandbox mode
app.post('/api/mock-rpc/send-transaction', (req: Request, res: Response) => {
  const { transactionB64 } = req.body;
  try {
    const rawTx = Buffer.from(transactionB64, 'base64');
    const tx = Transaction.from(rawTx);
    
    const signature = tx.signature;
    if (!signature) {
      return res.status(400).json({ error: 'No signature found on transaction' });
    }
    const signatureStr = bs58.encode(signature);

    console.log(`[Mock RPC] Received transaction raw payload. Signature: ${signatureStr}`);

    // Deserialize message and extract details
    const message = tx.compileMessage();
    const accountKeys = message.accountKeys;
    
    // Find the transfer instruction details
    let amountSol = 0;
    let recipientStr = '';
    const memos: string[] = [];

    for (const instruction of tx.instructions) {
      if (instruction.programId.equals(SystemProgram.programId)) {
        if (instruction.data.length >= 12) {
          const typeIndex = instruction.data.readUInt32LE(0);
          if (typeIndex === 2) {
            const lamports = Number(instruction.data.readBigUInt64LE(4));
            amountSol = lamports / 1e9;
            recipientStr = instruction.keys[1].pubkey.toBase58();
          }
        }
      }
      // MPP: capture Memo instructions carrying the challenge externalId
      if (isMemoProgramId(instruction.programId.toBase58())) {
        memos.push(instruction.data.toString('utf-8'));
      }
    }

    // Populate mock transaction metadata
    const mockTxResponse = {
      slot: 12345,
      memos,
      transaction: {
        signatures: [signatureStr],
        message: {
          accountKeys: accountKeys
        }
      },
      meta: {
        preBalances: accountKeys.map((key) => {
          if (key.equals(tx.feePayer!)) return 10 * 1e9;
          return 0;
        }),
        postBalances: accountKeys.map((key) => {
          if (key.equals(tx.feePayer!)) return (10 - amountSol) * 1e9 - 5000;
          if (key.toBase58() === recipientStr) return amountSol * 1e9;
          return 0;
        })
      }
    };

    // Store in mockTransactions
    mockTransactions.set(signatureStr, mockTxResponse);
    console.log(`[Mock RPC] Registered mock transaction ${signatureStr}. Amount: ${amountSol} SOL -> ${recipientStr}`);

    return res.status(200).json({ signature: signatureStr });
  } catch (error: any) {
    console.error('[Mock RPC] Error registering transaction:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Function to verify transactions (supports mock and devnet).
// The payment must be bound to the issued challenge via EITHER the classic
// Solana Pay reference key (account key) OR the MPP externalId embedded as
// an on-chain Memo instruction.
async function verifyPayment(
  signature: string,
  recipient: PublicKey,
  amountSol: number,
  binding: { legacyReference?: PublicKey; externalId?: string }
): Promise<boolean> {
  return tracer.startActiveSpan('payment.verify_onchain', async (span) => {
    span.setAttributes({
      'payment.signature': signature,
      'payment.amount_sol': amountSol,
      'payment.recipient': recipient.toBase58(),
      'payment.binding.memo': binding.externalId ? 'present' : 'absent',
      'payment.binding.reference_key': binding.legacyReference ? 'present' : 'absent'
    });
    try {
      const result = await verifyPaymentInner(signature, recipient, amountSol, binding);
      span.setAttribute('payment.verification_result', result ? 'success' : 'failed');
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setAttribute('payment.verification_result', 'error');
      throw error;
    } finally {
      span.end();
    }
  });
}

async function verifyPaymentInner(
  signature: string,
  recipient: PublicKey,
  amountSol: number,
  binding: { legacyReference?: PublicKey; externalId?: string }
): Promise<boolean> {
  try {
    // 1. Check mock store first
    let tx = mockTransactions.get(signature);
    let txMemos: string[] = [];

    if (tx) {
      console.log(`[Agent B] Signature ${signature} found in local mock store (Sandbox Mode).`);
      txMemos = tx.memos || [];
    } else {
      console.log(`[Agent B] Signature ${signature} not in mock store. Querying Solana Devnet...`);
      tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
    }

    if (!tx) {
      console.log(`[Agent B] Transaction ${signature} not found on-chain or in mock store.`);
      return false;
    }

    // 2. Verify the payment is bound to this challenge
    const message = tx.transaction.message as any;
    const accountKeys: PublicKey[] = message.accountKeys || message.staticAccountKeys || [];

    let bound = false;

    // 2a. Classic Solana Pay style: reference key present in account keys
    if (binding.legacyReference) {
      bound = accountKeys.some((key: PublicKey) => key.equals(binding.legacyReference!));
      if (!bound) {
        console.log(`[Agent B] Transaction does not contain the reference key: ${binding.legacyReference.toBase58()}`);
      }
    }

    // 2b. MPP style: externalId embedded as a Memo instruction
    if (!bound && binding.externalId) {
      if (txMemos.length === 0 && message) {
        const instructions = message.instructions || message.compiledInstructions || [];
        txMemos = extractMemosFromCompiledMessage(accountKeys, instructions);
      }
      bound = txMemos.some((memo) => memo === binding.externalId);
      if (!bound) {
        console.log(`[Agent B] Transaction does not contain the externalId memo: ${binding.externalId}`);
      }
    }

    if (!bound) return false;

    // 3. Verify recipient received the correct amount
    const recipientIndex = accountKeys.findIndex((key: PublicKey) => key.equals(recipient));
    if (recipientIndex === -1) {
      console.log(`[Agent B] Recipient ${recipient.toBase58()} not found in transaction accounts.`);
      return false;
    }

    // Check balances changes
    const preBalance = tx.meta?.preBalances[recipientIndex] || 0;
    const postBalance = tx.meta?.postBalances[recipientIndex] || 0;
    const receivedLamports = postBalance - preBalance;
    const expectedLamports = amountSol * 1e9;

    console.log(`[Agent B] Tx Received Lamports: ${receivedLamports}, Expected Lamports: ${expectedLamports}`);

    if (receivedLamports >= expectedLamports) {
      return true;
    } else {
      console.log(`[Agent B] Received lamports (${receivedLamports}) is less than expected (${expectedLamports})`);
      return false;
    }
  } catch (error) {
    console.error('[Agent B] Error fetching/verifying transaction:', error);
    return false;
  }
}

/**
 * Automated 1688 Supplier Inventory Reservation Endpoint
 */
app.post('/api/orders/reserve', async (req: Request, res: Response) => {
  const { productId, quantity, buyerWallet, paymentSignature } = req.body;
  if (!productId || !buyerWallet) {
    return res.status(400).json({ error: 'Missing required parameters: productId, buyerWallet' });
  }

  try {
    const reservation = await reserveSupplierOrder({
      productId,
      quantity: quantity || 1,
      buyerWallet,
      paymentSignature: paymentSignature || '5M2z...8kLm'
    });
    return res.status(200).json({
      status: 'success',
      message: `1688 Supplier inventory reserved for Order ${reservation.orderId}`,
      data: reservation
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Gemini Supervisor Heterogeneous Multi-Model Ensemble Endpoint
 */
app.post('/api/agent/ensemble', async (req: Request, res: Response) => {
  const { query, productId } = req.body;
  const userQuery = query || "30대 여성층 타겟 유아 롬퍼 추천 아이템";

  try {
    const products = await queryProducts();
    const targetProduct = products.find(p => p.productId === productId) || products[0] || {
      productId: "1688-romper-88201",
      title: "2025 여름 신생아 여아 순면 스플라이싱 롬퍼 아동복 수트",
      price: 12.5
    };

    const ensembleResult = await executeMultiModelEnsemble(userQuery, targetProduct);
    return res.status(200).json(ensembleResult);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Benchmark 1 (Amazon Taxonomy) & Benchmark 3 (AliResearch 1688 Trade) Evaluation Endpoint
 */
app.post('/api/benchmark/1and3', async (req: Request, res: Response) => {
  const { productId } = req.body;
  try {
    const products = await queryProducts();
    const targetProduct = products.find(p => p.productId === productId) || products[0] || {
      productId: "1688-romper-88201",
      title: "2025 여름 신생아 여아 순면 스플라이싱 롬퍼 아동복 수트",
      price: 12.5
    };

    const benchmarkResult = await evaluateBenchmark1And3(targetProduct);
    return res.status(200).json(benchmarkResult);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Personalized Sourcing Intelligence Feed & Factory Directory Endpoint
 */
app.get('/api/feed/personalized', async (req: Request, res: Response) => {
  const persona = (req.query.persona as string) || "BABYWEAR_EXPERT";
  try {
    const feed = await getPersonalizedSourcingFeed(persona);
    return res.status(200).json(feed);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Beginner E-Commerce Chat Consultation & Auto-Portfolio Generator Endpoints
 */
app.get('/api/consult/pain-points', (_req: Request, res: Response) => {
  return res.status(200).json({ painPoints: BEGINNER_PAIN_POINTS });
});

app.post('/api/consult/chat', async (req: Request, res: Response) => {
  const { message, budget } = req.body;
  const userMessage = message || "초기 자본금 300만원으로 유아복 사입 포트폴리오를 만들어줘";
  const capitalBudget = budget || 3000000;

  try {
    const portfolioReport = await generateBeginnerConsultation(userMessage, capitalBudget);
    return res.status(200).json(portfolioReport);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * pay.sh Solana Protocol HTTP 402 Challenge & Verification Endpoints
 */
app.get('/api/paysh/challenge', (req: Request, res: Response) => {
  const amountSol = parseFloat((req.query.amount as string) || '0.015');
  const productId = (req.query.productId as string) || '1688-romper-88201';

  const challenge = createPayShChallenge(amountSol, productId);

  res.setHeader('x-payment-required', 'true');
  res.setHeader('x-payment-recipient', challenge.recipientWallet);
  res.setHeader('x-payment-amount-sol', challenge.amountSol.toString());
  res.setHeader('x-payment-reference', challenge.reference);

  return res.status(402).json(challenge);
});

app.post('/api/paysh/verify', async (req: Request, res: Response) => {
  const { signature, amountSol, recipientWallet } = req.body;
  const txSig = signature || `5M2z${Math.random().toString(36).substring(2, 8)}8kLm${Math.random().toString(36).substring(2, 6)}`;

  try {
    const result = await verifyPayShTransaction(txSig, amountSol || 0.015, recipientWallet);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Custom Product Ontology Knowledge Graph Search & Personalization API
 */
app.post('/api/ontology/search', async (req: Request, res: Response) => {
  const { query, profile } = req.body;
  const q = query || "유아복 롬퍼";

  try {
    const result = await searchA2AOntologyGraph(q, profile);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Full Multi-Dimensional User Circumstance <-> Product <-> A2A Knowledge Graph Binding API
 */
app.post('/api/ontology/user-product-binding', async (req: Request, res: Response) => {
  const { query, userProfile } = req.body;
  const q = query || "유아복 롬퍼";

  try {
    const result = await executeFullPersonalizedOntologyBinding(q, userProfile);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 100 Distinct Category E-Commerce Benchmark Dataset Ingestion API
 */
app.get('/api/benchmark/100-categories', (req: Request, res: Response) => {
  try {
    const dataset = generate100CategoriesDataset();
    return res.status(200).json({
      status: "success",
      totalCategoriesCount: dataset.length,
      macroSectorsCount: 10,
      dataset
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Multi-Platform Ingestion (1688 + Taobao + Baidu) & Kimi 3.0 vs GPT-OSS-120B Benchmark API
 */
app.get('/api/benchmark/kimi-vs-gpt', async (req: Request, res: Response) => {
  const keyword = (req.query.keyword as string) || "유아복 롬퍼";
  try {
    const benchmarkResult = await runMultiPlatformKimiVsGptBenchmark(keyword);
    return res.status(200).json(benchmarkResult);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 100-Scenario Empirical Ontology Noise Reduction Benchmark Experiment API
 */
app.get('/api/benchmark/empirical-experiment', (req: Request, res: Response) => {
  try {
    const experimentResult = runEmpiricalOntologyBenchmarkExperiment();
    return res.status(200).json({
      status: "success",
      experiment: experimentResult
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Coupang ↔ 1688 Comparator & Interest Profiles
 */
app.post('/api/comparator/sweep', async (_req: Request, res: Response) => {
  try {
    const snapshots = await runComparatorSweep();
    return res.status(200).json({ status: 'success', snapshotsCreated: snapshots.length, snapshots });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/comparator/latest', (_req: Request, res: Response) => {
  return res.status(200).json({ leaderboard: getLatestSnapshots() });
});

app.get('/api/comparator/curve/:productId', (req: Request, res: Response) => {
  return res.status(200).json({
    productId: req.params.productId,
    curve: getMarginCurve(req.params.productId)
  });
});

app.get('/api/profiles', (_req: Request, res: Response) => {
  return res.status(200).json({ profiles: listProfiles() });
});

app.listen(PORT, '0.0.0.0', async () => {
  await initDb();
  // Continuous Coupang ↔ 1688 margin comparison (default 15min; 0 disables)
  startComparatorLoop(parseInt(process.env.COMPARATOR_INTERVAL_MS || '900000'));
  runComparatorSweep().catch(() => { /* warm-up best effort */ });
  console.log(`Pay.sh Data API Server (Agent B) running on http://0.0.0.0:${PORT}`);
});
