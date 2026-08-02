/**
 * comparatorEngine.ts — Continuous Coupang ↔ China(1688) margin comparator
 *
 * For every known product, periodically computes a margin snapshot:
 *
 *   landedCostKrw = wholesaleUsd × FX + intlShipping(weight) + tariff(category)
 *   marginKrw     = coupangPriceKrw − landedCostKrw
 *   roiPercent    = marginKrw / landedCostKrw × 100
 *
 * Snapshots form a per-product margin curve (ring buffer, newest first).
 * The Coupang side is currently the benchmark price carried in the product's
 * JSON-LD (mock); swap `fetchCoupangPriceKrw` for the real price API later.
 */
import { queryProducts } from './db';
import { logEvent, comparatorSweeps, comparatorMarginGauge } from './observability';

export interface PriceSnapshot {
  productId: string;
  title: string;
  capturedAt: string;
  chinaWholesaleUsd: number;
  fxKrwPerUsd: number;
  intlShippingKrw: number;
  tariffKrw: number;
  landedCostKrw: number;
  coupangPriceKrw: number;
  marginKrw: number;
  roiPercent: number;
}

const FX_KRW_PER_USD = parseFloat(process.env.FX_KRW_PER_USD || '1400');
const MAX_SNAPSHOTS_PER_PRODUCT = 96; // 24h @ 15min interval

// In-memory margin curves: productId → snapshots (newest first)
const marginCurves = new Map<string, PriceSnapshot[]>();

/** Tariff estimate by JSON-LD category (demo schedule). */
function estimateTariffKrw(category: string | undefined, baseKrw: number): number {
  const c = (category || '').toLowerCase();
  // RCEP 0% buckets vs. general 8–13% apparel duty (simplified demo schedule)
  if (c.includes('romper') || c.includes('apparel') || c.includes('clothes')) {
    return Math.round(baseKrw * 0.08);
  }
  if (c.includes('toy') || c.includes('electronics')) {
    return 0; // common RCEP 0% categories
  }
  return Math.round(baseKrw * 0.05);
}

/** Air-freight estimate from shipping weight (grams). */
function estimateIntlShippingKrw(weightGrm: number): number {
  // ~7 KRW/g baseline with a 2,000 KRW minimum (demo schedule)
  return Math.max(2000, Math.round(weightGrm * 7));
}

/** Coupang-side retail price. Mock: JSON-LD benchmark; swap with real API. */
function fetchCoupangPriceKrw(product: any): number | undefined {
  const props: any[] = product.dataJsonLd?.additionalProperty || [];
  const bench = props.find((p) => p.name === 'Korean Benchmark Retail Price');
  return bench ? Number(bench.value) : undefined;
}

function shippingWeightGrm(product: any): number {
  const props: any[] = product.dataJsonLd?.additionalProperty || [];
  const w = props.find((p) => p.name === 'Shipping Weight');
  return w ? Number(w.value) : 300;
}

/** Compute one margin snapshot for a product. */
export function compareProduct(product: any): PriceSnapshot | null {
  const coupangPriceKrw = fetchCoupangPriceKrw(product);
  if (!coupangPriceKrw) return null;

  const wholesaleUsd = Number(product.price) || 0;
  const baseKrw = Math.round(wholesaleUsd * FX_KRW_PER_USD);
  const intlShippingKrw = estimateIntlShippingKrw(shippingWeightGrm(product));
  const tariffKrw = estimateTariffKrw(product.dataJsonLd?.category, baseKrw);
  const landedCostKrw = baseKrw + intlShippingKrw + tariffKrw;
  const marginKrw = coupangPriceKrw - landedCostKrw;
  const roiPercent = landedCostKrw > 0 ? (marginKrw / landedCostKrw) * 100 : 0;

  return {
    productId: product.productId,
    title: product.title,
    capturedAt: new Date().toISOString(),
    chinaWholesaleUsd: wholesaleUsd,
    fxKrwPerUsd: FX_KRW_PER_USD,
    intlShippingKrw,
    tariffKrw,
    landedCostKrw,
    coupangPriceKrw,
    marginKrw,
    roiPercent: Math.round(roiPercent * 10) / 10,
  };
}

/** Run one sweep over all known products; returns new snapshots. */
export async function runComparatorSweep(): Promise<PriceSnapshot[]> {
  const products = await queryProducts();
  const snapshots: PriceSnapshot[] = [];

  for (const product of products) {
    const snap = compareProduct(product);
    if (!snap) continue;
    const curve = marginCurves.get(snap.productId) || [];
    curve.unshift(snap);
    if (curve.length > MAX_SNAPSHOTS_PER_PRODUCT) curve.length = MAX_SNAPSHOTS_PER_PRODUCT;
    marginCurves.set(snap.productId, curve);
    comparatorMarginGauge.set({ productId: snap.productId }, snap.roiPercent);
    snapshots.push(snap);
  }

  comparatorSweeps.inc({ result: 'ok' });
  logEvent('info', 'comparator.sweep_completed', {
    productsEvaluated: products.length,
    snapshotsCreated: snapshots.length,
    avgRoiPercent:
      snapshots.length > 0
        ? Math.round((snapshots.reduce((a, s) => a + s.roiPercent, 0) / snapshots.length) * 10) / 10
        : null,
  });
  return snapshots;
}

/** Latest snapshot per product (margin leaderboard, best ROI first). */
export function getLatestSnapshots(): PriceSnapshot[] {
  return Array.from(marginCurves.values())
    .map((curve) => curve[0])
    .filter(Boolean)
    .sort((a, b) => b.roiPercent - a.roiPercent);
}

export function getMarginCurve(productId: string): PriceSnapshot[] {
  return marginCurves.get(productId) || [];
}

let loopTimer: NodeJS.Timeout | null = null;

/** Start the continuous comparison loop (disabled when intervalMs <= 0). */
export function startComparatorLoop(intervalMs: number) {
  if (intervalMs <= 0 || loopTimer) return;
  loopTimer = setInterval(() => {
    runComparatorSweep().catch((err) =>
      logEvent('error', 'comparator.sweep_failed', { error: err.message })
    );
  }, intervalMs);
  loopTimer.unref?.();
  logEvent('info', 'comparator.loop_started', { intervalMs });
}
