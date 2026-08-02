/**
 * coupangObservationStore.ts — Real Coupang retail price observations.
 *
 * OpenClaw (user's browser agent) or a human posts prices they SEE on
 * coupang.com — product-info only, read-side. These observed prices become
 * the comparator's Coupang-side anchor (highest-priority real source) and
 * let us estimate "the Coupang seller's margin" for SEONDAL users.
 */
import { logEvent, coupangObservations } from './observability';

export interface CoupangPriceObservation {
  productName: string;
  priceKrw: number;
  url?: string;
  category?: string;
  source: string; // 'openclaw' | 'manual' | ...
  capturedAt: string;
}

const observations: CoupangPriceObservation[] = [];
const MAX_OBSERVATIONS = 500;

export function addObservation(obs: Omit<CoupangPriceObservation, 'capturedAt'>): CoupangPriceObservation {
  const full: CoupangPriceObservation = { ...obs, capturedAt: new Date().toISOString() };
  observations.unshift(full);
  if (observations.length > MAX_OBSERVATIONS) observations.length = MAX_OBSERVATIONS;
  coupangObservations.inc({ source: obs.source || 'unknown' });
  logEvent('info', 'coupang.observation_added', {
    productName: obs.productName.slice(0, 60), priceKrw: obs.priceKrw, source: obs.source,
  });
  return full;
}

export function listObservations(limit = 100): CoupangPriceObservation[] {
  return observations.slice(0, limit);
}

/** Token-overlap match: find the best observed price for a product title. */
export function matchObservation(title: string): CoupangPriceObservation | undefined {
  const tokens = (title || '').toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return undefined;
  let best: { obs: CoupangPriceObservation; hits: number } | undefined;
  for (const obs of observations) {
    const name = obs.productName.toLowerCase();
    const hits = tokens.filter((t) => name.includes(t)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { obs, hits };
  }
  return best && best.hits >= Math.min(2, tokens.length) ? best.obs : undefined;
}
