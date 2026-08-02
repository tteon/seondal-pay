/**
 * marketPieEngine.ts — Market pie & entry-margin analysis from observed data.
 *
 * From OpenClaw/manual Coupang observations (name, price, monthlySales):
 *   1. Market pie: top-5 sellers by monthly sales and their share of the pie
 *   2. Entry analysis: what price a SEONDAL user must set to enter that pie,
 *      and how much margin that forces them to sacrifice vs their target ROI.
 *
 * "이 마켓파이에 진입하려면 최소 얼마의 마진을 줄여야 하는가" 에 대한 답.
 */
import { listObservations, CoupangPriceObservation } from './coupangObservationStore';
import { logEvent } from './observability';

export interface MarketPieEntry {
  rank: number;
  productName: string;
  priceKrw: number;
  monthlySales: number;
  sharePercent: number;
  url?: string;
}

export interface MarketPieReport {
  group: string;
  source: 'observations';
  top: MarketPieEntry[];
  totalMonthlySales: number;
  priceMinKrw: number;
  priceMedianKrw: number;
  priceMaxKrw: number;
  note: string;
  generatedAt: string;
}

export interface EntryPriceCandidate {
  label: string;
  priceKrw: number;
  netRevenueKrw: number;
  marginKrw: number;
  roiPercent: number;
  marginSacrificeKrw: number;
  feasible: boolean;
}

export interface EntryAnalysis {
  group: string;
  ourLandedCostKrw: number;
  targetRoiPct: number;
  targetPriceKrw: number;
  candidates: EntryPriceCandidate[];
  minimumMarginSacrifice: {
    entryPriceKrw: number;
    entryRoiPercent: number;
    sacrificeKrw: number;
    sacrificePctOfTarget: number;
  } | null;
  guide: string;
  generatedAt: string;
}

const COUPANG_FEE_RATE = parseFloat(process.env.COUPANG_FEE_RATE || '0.108');
const DEFAULT_SHIPPING_FEE = 3000;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
}

/** Domain synonym map — the ontology's sameAsSynonym relation in action. */
const GROUP_SYNONYMS: Record<string, string[]> = {
  '식기': ['식기', '식판', '스푼', '턱받이', '빨대컵', '이유식'],
  '간식': ['간식', '과자', '떡뻥', '퓨레', '치즈', '시리얼', '요거트'],
  '선풍기': ['선풍기', '핸디팬', '핸디'],
  '가방': ['가방', '백팩', '파우치', '수납백', '토트백'],
  '수건': ['수건', '타올', '손수건'],
  '롬퍼': ['롬퍼', '바디수트', '우주복'],
  '매트': ['매트'],
  '샴푸': ['샴푸', '바디'],
  '치발기': ['치발기', '치약'],
  '수유등': ['수유등', '무드등', '수면등', '조명'],
};

/** Observations for a group: category field first, then synonym-aware token match. */
function observationsFor(group: string): CoupangPriceObservation[] {
  const g = group.toLowerCase().trim();
  const all = listObservations(500);
  // 1) category field match (exact or substring)
  const byCategory = all.filter((o) => (o.category || '').toLowerCase() === g || (o.category || '').toLowerCase().includes(g));
  if (byCategory.length > 0) return byCategory;
  // 2) synonym-aware match: every group token (or one of its synonyms) appears
  const tokens = g.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  return all.filter((o) => {
    const name = o.productName.toLowerCase();
    return tokens.every((t) => {
      const syns = GROUP_SYNONYMS[t] || [t];
      return syns.some((s) => name.includes(s));
    });
  });
}

/** Market pie: top-5 by monthly sales with share of total top-N sales. */
export function computeMarketPie(group: string): MarketPieReport {
  const obs = observationsFor(group).filter((o) => (o.monthlySales || 0) > 0);
  const ranked = [...obs].sort((a, b) => (b.monthlySales || 0) - (a.monthlySales || 0)).slice(0, 5);
  const total = ranked.reduce((a, o) => a + (o.monthlySales || 0), 0);
  const prices = ranked.map((o) => o.priceKrw);

  return {
    group,
    source: 'observations',
    top: ranked.map((o, i) => ({
      rank: i + 1,
      productName: o.productName,
      priceKrw: o.priceKrw,
      monthlySales: o.monthlySales || 0,
      sharePercent: total > 0 ? Math.round(((o.monthlySales || 0) / total) * 1000) / 10 : 0,
      url: o.url,
    })),
    totalMonthlySales: total,
    priceMinKrw: prices.length ? Math.min(...prices) : 0,
    priceMedianKrw: median(prices),
    priceMaxKrw: prices.length ? Math.max(...prices) : 0,
    note:
      ranked.length === 0
        ? '판매량 데이터가 있는 관측이 없습니다 — OpenClaw 수집 시 monthlySales를 함께 볼 필요가 있습니다.'
        : `관측 ${obs.length}건 중 판매량 보유 ${ranked.length}건 (TOP ${ranked.length} 기준 파이)`,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Entry-margin analysis: given OUR landed cost and the incumbent price
 * distribution, compute entry-price candidates and the margin sacrifice
 * each implies. Target ROI defaults to 30%.
 */
export function computeEntryAnalysis(
  group: string,
  ourLandedCostKrw: number,
  targetRoiPct = 30,
  shippingFeeKrw = DEFAULT_SHIPPING_FEE
): EntryAnalysis {
  const pie = computeMarketPie(group);
  const fee = (price: number) => Math.round(price * COUPANG_FEE_RATE);
  const netOf = (price: number) => price - fee(price) - shippingFeeKrw;
  const marginOf = (price: number) => netOf(price) - ourLandedCostKrw;
  const roiOf = (price: number) => (ourLandedCostKrw > 0 ? (marginOf(price) / ourLandedCostKrw) * 100 : 0);

  // The price WE would charge to hit the target ROI: price − fee − ship − cost = cost × targetROI
  // → price = (cost × (1 + targetROI) + ship) / (1 − feeRate)
  const targetPriceKrw = Math.round(
    (ourLandedCostKrw * (1 + targetRoiPct / 100) + shippingFeeKrw) / (1 - COUPANG_FEE_RATE)
  );
  const targetMarginKrw = marginOf(targetPriceKrw);

  const mk = (label: string, priceKrw: number): EntryPriceCandidate => ({
    label,
    priceKrw,
    netRevenueKrw: netOf(priceKrw),
    marginKrw: marginOf(priceKrw),
    roiPercent: Math.round(roiOf(priceKrw) * 10) / 10,
    marginSacrificeKrw: targetMarginKrw - marginOf(priceKrw),
    feasible: marginOf(priceKrw) > 0,
  });

  const candidates: EntryPriceCandidate[] = [];
  if (pie.priceMinKrw > 0) {
    candidates.push(mk('🏷️ 최저가 언더컷 (−3%)', Math.round(pie.priceMinKrw * 0.97)));
    candidates.push(mk('⚖️ 중앙값 매칭', pie.priceMedianKrw));
    candidates.push(mk('💎 프리미엄 (최고가 매칭)', pie.priceMaxKrw));
    candidates.push(mk('🎯 목표 ROI 가격', targetPriceKrw));
  }

  // Minimum sacrifice: enter AT the incumbent floor (pie.priceMinKrw)
  let minimumMarginSacrifice: EntryAnalysis['minimumMarginSacrifice'] = null;
  if (pie.priceMinKrw > 0) {
    const entryPrice = pie.priceMinKrw;
    const entryMargin = marginOf(entryPrice);
    const sacrifice = targetMarginKrw - entryMargin;
    minimumMarginSacrifice = {
      entryPriceKrw: entryPrice,
      entryRoiPercent: Math.round(roiOf(entryPrice) * 10) / 10,
      sacrificeKrw: sacrifice,
      sacrificePctOfTarget: targetMarginKrw > 0 ? Math.round((sacrifice / targetMarginKrw) * 1000) / 10 : 0,
    };
  }

  const guide = minimumMarginSacrifice
    ? minimumMarginSacrifice.entryRoiPercent <= 0
      ? `⛔ '${group}' 파이의 최저가(₩${pie.priceMinKrw.toLocaleString()})에 맞추면 마진이 마이너스 — 이 시장은 현재 원가 구조로 진입 불가. 도매가/물류를 먼저 낮추세요.`
      : `✅ '${group}' 진입: 최저가 ₩${pie.priceMinKrw.toLocaleString()} 매칭 시 ROI ${minimumMarginSacrifice.entryRoiPercent}% — 목표 마진의 ${Math.round(minimumMarginSacrifice.sacrificePctOfTarget)}%(₩${minimumMarginSacrifice.sacrificeKrw.toLocaleString()})를 줄여야 진입 가능.`
    : `'${group}'의 시장 데이터 부족 — OpenClaw로 해당 카테고리 가격·판매량을 먼저 수집하세요.`;

  logEvent('info', 'marketpie.entry_analysis', {
    group, landedCost: ourLandedCostKrw, targetRoiPct,
    incumbents: pie.top.length, minPrice: pie.priceMinKrw,
  });

  return {
    group,
    ourLandedCostKrw,
    targetRoiPct,
    targetPriceKrw,
    candidates,
    minimumMarginSacrifice,
    guide,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Portfolio integration (non-invasive enrichment wrapper)
// ---------------------------------------------------------------------------

export interface MarketEntryLine {
  group: string;
  entryRoiPercent: number | null;
  entryPriceKrw: number | null;
  sacrificeKrw: number | null;
  verdict: 'enter' | 'shrink' | 'avoid' | 'no-data';
  guide: string;
}

const TARGET_ROI_BY_LEVEL: Record<string, number> = { beginner: 40, growth: 30, mature: 25 };

/** Compute entry analysis for one portfolio line (category → pie group). */
export function entryForLine(category: string, title: string, landedCostKrw: number, level: string): MarketEntryLine {
  const targetRoi = TARGET_ROI_BY_LEVEL[level] ?? 30;
  // group: category first, fallback to first 2 title tokens
  const group = category || (title || '').split(/\s+/).slice(0, 2).join(' ');
  const analysis = computeEntryAnalysis(group, landedCostKrw, targetRoi);
  const ms = analysis.minimumMarginSacrifice;
  if (!ms) {
    return { group, entryRoiPercent: null, entryPriceKrw: null, sacrificeKrw: null, verdict: 'no-data', guide: analysis.guide };
  }
  const verdict: MarketEntryLine['verdict'] =
    ms.entryRoiPercent >= targetRoi ? 'enter' : ms.entryRoiPercent >= 10 ? 'shrink' : 'avoid';
  return {
    group,
    entryRoiPercent: ms.entryRoiPercent,
    entryPriceKrw: ms.entryPriceKrw,
    sacrificeKrw: ms.sacrificeKrw,
    verdict,
    guide: analysis.guide,
  };
}

/** Attach market-entry analysis to every line of a portfolio result. */
export function enrichPortfolioWithMarketEntry(portfolio: any): any {
  const level = portfolio.level || 'beginner';
  const lines = (portfolio.lines || []).map((line: any) => ({
    ...line,
    marketEntry: entryForLine(line.category, line.title, line.landedCostKrw, level),
  }));
  const enterable = lines.filter((l: any) => l.marketEntry.verdict === 'enter' || l.marketEntry.verdict === 'shrink');
  return {
    ...portfolio,
    lines,
    marketEntrySummary: {
      enterableLines: enterable.length,
      totalLines: lines.length,
      guide:
        enterable.length === 0
          ? '현재 관측 데이터 기준으로는 진입 가능한 라인이 없습니다 — 원가 절감 또는 다른 카테고리 검토가 필요합니다.'
          : `${enterable.length}/${lines.length}개 라인이 현재 마켓 파이에 진입 가능합니다.`,
    },
  };
}
