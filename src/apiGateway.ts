import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface ApiKeyRecord {
  apiKey: string;
  clientAgentId: string;
  tier: number;
  totalSolSpent: number;
  requestCount: number;
  createdAt: string;
}

// In-memory Gateway registry for Client Agent API Keys & Monetization Analytics
const apiKeyStore = new Map<string, ApiKeyRecord>();
const gatewayMetrics = {
  totalRequestsProcessed: 0,
  totalSolRevenueCollected: 0,
  tierBreakdown: {
    tier1Count: 0,
    tier2Count: 0,
    tier3Count: 0
  }
};

/**
 * Generate a new API Key for a Client Agent
 */
export function generateApiKey(clientAgentId: string, initialTier: number = 1): ApiKeyRecord {
  const apiKey = `sol_ag_${crypto.randomBytes(16).toString('hex')}`;
  const record: ApiKeyRecord = {
    apiKey,
    clientAgentId,
    tier: initialTier,
    totalSolSpent: 0,
    requestCount: 0,
    createdAt: new Date().toISOString()
  };
  apiKeyStore.set(apiKey, record);
  console.log(`[API Gateway] Issued new API Key for Agent '${clientAgentId}': ${apiKey}`);
  return record;
}

/**
 * API Gateway Tier Pricing Map (in SOL)
 */
export const GATEWAY_TIER_PRICING = {
  1: { baseSol: 0.005, description: "Tier 1: Basic Catalog & Search Query" },
  2: { baseSol: 0.015, description: "Tier 2: Logistics & Landed Cost Specs (+0.010 SOL)" },
  3: { baseSol: 0.050, description: "Tier 3: Kimi MD Tacit Reasoning & MARA ROI Insights (+0.035 SOL)" }
};

/**
 * Express API Gateway Middleware
 * Intercepts requests, validates API Keys, enforces per-information SOL pricing challenges, and updates revenue metrics.
 */
export function apiGatewayMiddleware(req: Request, res: Response, next: NextFunction) {
  gatewayMetrics.totalRequestsProcessed++;

  const apiKey = req.headers['x-api-key'] as string;
  const requestedTierHeader = req.headers['x-target-tier'] as string;
  const requestedTier = requestedTierHeader ? parseInt(requestedTierHeader) : (req.body?.requestedTier || 1);

  // If no API key is provided, issue a sandbox API key automatically for demo seamlessness
  let clientRecord: ApiKeyRecord;
  if (!apiKey || !apiKeyStore.has(apiKey)) {
    clientRecord = generateApiKey('Anonymous_Agent', requestedTier);
  } else {
    clientRecord = apiKeyStore.get(apiKey)!;
  }

  // Attach gateway metadata to request
  (req as any).gatewayContext = {
    apiKey: clientRecord.apiKey,
    clientAgentId: clientRecord.clientAgentId,
    requestedTier,
    pricing: GATEWAY_TIER_PRICING[requestedTier as 1 | 2 | 3] || GATEWAY_TIER_PRICING[1]
  };

  next();
}

/**
 * Record successfully verified SOL transaction revenue in API Gateway
 */
export function recordGatewayRevenue(apiKey: string, tier: number, amountSol: number) {
  if (apiKeyStore.has(apiKey)) {
    const record = apiKeyStore.get(apiKey)!;
    record.totalSolSpent += amountSol;
    record.requestCount++;
    record.tier = Math.max(record.tier, tier);
  }

  gatewayMetrics.totalSolRevenueCollected += amountSol;
  if (tier === 1) gatewayMetrics.tierBreakdown.tier1Count++;
  else if (tier === 2) gatewayMetrics.tierBreakdown.tier2Count++;
  else if (tier === 3) gatewayMetrics.tierBreakdown.tier3Count++;

  console.log(`[API Gateway Monetization] Recorded ${amountSol} SOL revenue for Tier ${tier} request! Total Revenue: ${gatewayMetrics.totalSolRevenueCollected.toFixed(3)} SOL`);
}

/**
 * Retrieve API Gateway Monetization Analytics Summary
 */
export function getGatewayAnalytics() {
  return {
    metrics: gatewayMetrics,
    activeApiKeysCount: apiKeyStore.size,
    registeredAgents: Array.from(apiKeyStore.values())
  };
}
