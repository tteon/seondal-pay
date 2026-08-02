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
import { isCoupangConfigured, searchProducts, CoupangProduct } from './coupangPartnersClient';
import { benchmarkForProduct } from './coupangBenchmarkEngine';

export interface PriceSnapshot {
  productId: string;
  title: string;
  capturedAt: string;
  chinaWholesaleUsd: number;
  chinaWholesaleCny?: number;
  fxKrwPerUsd: number;
  intlShippingKrw: number;
  tariffKrw: number;
  landedCostKrw: number;
  coupangPriceKrw: number;
  coupangFeeKrw: number;        // 판매 수수료 (10.8% of sale price)
  coupangShippingFeeKrw: number; // 카테고리 가정 배송비
  netRevenueKrw: number;         // coupangPrice − fee − shipping
  marginKrw: number;             // netRevenue − landedCost
  roiPercent: number;            // margin / landedCost × 100
  coupangSource?: 'partners-api' | 'mock-benchmark';
  coupangProductName?: string;
  coupangProductUrl?: string;
}

const FX_KRW_PER_USD = parseFloat(process.env.FX_KRW_PER_USD || '1400');
const FX_KRW_PER_CNY = parseFloat(process.env.FX_KRW_PER_CNY || '190');
const COUPANG_FEE_RATE = parseFloat(process.env.COUPANG_FEE_RATE || '0.108'); // 판매가의 10.8%
const MAX_SNAPSHOTS_PER_PRODUCT = 96; // 24h @ 15min interval

/** Coupang shipping-fee assumption by category (카테고리별 상이 — 가정표). */
function coupangShippingFeeKrw(category: string | undefined, weightGrm: number): number {
  const c = (category || '').toLowerCase();
  if (weightGrm > 3000) return 6000;            // 중량물 가정
  if (c.includes('electronics') || c.includes('가전')) return 4000;
  if (c.includes('furniture') || c.includes('홈인테리어')) return 5000;
  return 3000;                                   // 기본 소형 상품
}

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

/** Coupang-side retail price. Mock: JSON-LD benchmark (used as fallback). */
function fetchMockBenchmarkKrw(product: any): number | undefined {
  const props: any[] = product.dataJsonLd?.additionalProperty || [];
  const bench = props.find((p) => p.name === 'Korean Benchmark Retail Price');
  return bench ? Number(bench.value) : undefined;
}

/** Extract a Korean search keyword from a (possibly mixed) product title. */
function titleToKeyword(title: string): string {
  const tokens = (title || '')
    .replace(/[，、,.\-_/()[\]{}0-9a-zA-Z]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return tokens.slice(0, 3).join(' ') || (title || '').slice(0, 10);
}

/**
 * REAL Coupang retail price via Partners API — keyword search, then pick the
 * median of the top results (robust against outliers). Falls back to the mock
 * benchmark when the API is unconfigured or errors.
 */
export async function fetchRealCoupangPrice(
  product: any
): Promise<{ priceKrw: number; source: 'partners-api' | 'mock-benchmark'; matched?: CoupangProduct } | undefined> {
  if (isCoupangConfigured()) {
    try {
      // 1) per-product keyword search (most specific)
      const keyword = titleToKeyword(product.title || '');
      const results = await searchProducts(keyword, 5);
      if (results.length > 0) {
        const prices = results.map((r) => r.productPrice).sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        return { priceKrw: median, source: 'partners-api', matched: results[Math.floor(results.length / 2)] };
      }
      // 2) category-level real benchmark (median of best-sellers)
      const bench = benchmarkForProduct(product);
      if (bench) {
        return {
          priceKrw: bench.medianPriceKrw,
          source: 'partners-api',
          matched: bench.topItems[0]
            ? { productName: `[${bench.categoryName} 베스트 중앙값]`, productPrice: bench.medianPriceKrw, productUrl: bench.topItems[0].productUrl, productId: 0, productImage: '' } as CoupangProduct
            : undefined,
        };
      }
    } catch (err: any) {
      logEvent('warn', 'coupang.lookup_failed', { error: err.message, productId: product.productId });
    }
  }
  const mock = fetchMockBenchmarkKrw(product);
  return mock ? { priceKrw: mock, source: 'mock-benchmark' } : undefined;
}

function shippingWeightGrm(product: any): number {
  const props: any[] = product.dataJsonLd?.additionalProperty || [];
  const w = props.find((p) => p.name === 'Shipping Weight');
  return w ? Number(w.value) : 300;
}

/** Wholesale base cost in KRW — handles USD and CNY(¥) price sources. */
function wholesaleBaseKrw(product: any): { baseKrw: number; usd: number; cny?: number } {
  const currency = (product.currency || 'USD').toUpperCase();
  const price = Number(product.price) || 0;
  if (currency === 'CNY' || currency === 'RMB' || currency === '¥') {
    const baseKrw = Math.round(price * FX_KRW_PER_CNY);
    return { baseKrw, usd: Math.round((baseKrw / FX_KRW_PER_USD) * 100) / 100, cny: price };
  }
  return { baseKrw: Math.round(price * FX_KRW_PER_USD), usd: price };
}

function buildSnapshot(product: any, priceKrw: number, source: 'partners-api' | 'mock-benchmark', matched?: CoupangProduct): PriceSnapshot {
  const { baseKrw, usd, cny } = wholesaleBaseKrw(product);
  const weight = shippingWeightGrm(product);
  const intlShippingKrw = estimateIntlShippingKrw(weight);
  const tariffKrw = estimateTariffKrw(product.dataJsonLd?.category, baseKrw);
  const landedCostKrw = baseKrw + intlShippingKrw + tariffKrw;
  // 쿠팡 측 순수익: 판매가 − 수수료(10.8%) − 카테고리 배송비(가정)
  const coupangFeeKrw = Math.round(priceKrw * COUPANG_FEE_RATE);
  const shipFee = coupangShippingFeeKrw(product.dataJsonLd?.category, weight);
  const netRevenueKrw = priceKrw - coupangFeeKrw - shipFee;
  const marginKrw = netRevenueKrw - landedCostKrw;
  const roiPercent = landedCostKrw > 0 ? (marginKrw / landedCostKrw) * 100 : 0;
  return {
    productId: product.productId,
    title: product.title,
    capturedAt: new Date().toISOString(),
    chinaWholesaleUsd: usd,
    chinaWholesaleCny: cny,
    fxKrwPerUsd: FX_KRW_PER_USD,
    intlShippingKrw,
    tariffKrw,
    landedCostKrw,
    coupangPriceKrw: priceKrw,
    coupangFeeKrw,
    coupangShippingFeeKrw: shipFee,
    netRevenueKrw,
    marginKrw,
    roiPercent: Math.round(roiPercent * 10) / 10,
    coupangSource: source,
    coupangProductName: matched?.productName,
    coupangProductUrl: matched?.productUrl,
  };
}

/** Compute one margin snapshot for a product (real Coupang price when configured). */
export async function compareProduct(product: any): Promise<PriceSnapshot | null> {
  const lookup = await fetchRealCoupangPrice(product);
  if (!lookup) return null;
  return buildSnapshot(product, lookup.priceKrw, lookup.source, lookup.matched);
}

/** Synchronous fallback (mock benchmark only) for legacy call sites. */
export function compareProductSync(product: any): PriceSnapshot | null {
  const price = fetchMockBenchmarkKrw(product);
  return price ? buildSnapshot(product, price, 'mock-benchmark') : null;
}

/** Run one sweep over all known products; returns new snapshots. */
export async function runComparatorSweep(): Promise<PriceSnapshot[]> {
  const products = await queryProducts();
  const snapshots: PriceSnapshot[] = [];

  for (const product of products) {
    const snap = await compareProduct(product);
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

/** Start the continuous comparison loop (disabled when intervalMs <= 0).
 *  Optional onSweep callback runs after every successful sweep. */
export function startComparatorLoop(intervalMs: number, onSweep?: (snapshots: PriceSnapshot[]) => void) {
  if (intervalMs <= 0 || loopTimer) return;
  loopTimer = setInterval(() => {
    runComparatorSweep()
      .then((snaps) => { try { onSweep?.(snaps); } catch { /* hook must not break the loop */ } })
      .catch((err) =>
        logEvent('error', 'comparator.sweep_failed', { error: err.message })
      );
  }, intervalMs);
  loopTimer.unref?.();
  logEvent('info', 'comparator.loop_started', { intervalMs });
}
