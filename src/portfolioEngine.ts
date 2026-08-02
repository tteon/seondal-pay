/**
 * portfolioEngine.ts — Category × ROI portfolio builder with real allocation math.
 *
 * The beginner's actual question: "what portfolio can I build AND actually
 * order within my budget?" This answers it with MOQ-quantized order lines
 * from live catalog data:
 *
 *   per line: qty = clamp(MOQ, floor(lineBudget / landedCost)), orderCost,
 *             expectedProfit = margin × qty
 *   totals: deployed / cash reserve / expected profit / expected ROI
 *
 * Allocation posture by level: beginner 40% deployed (safe test orders),
 * growth 60%, mature 80%.
 */
import { queryProducts } from './db';
import { compareProduct, PriceSnapshot } from './comparatorEngine';
import { logEvent } from './observability';
import { SellerLevel } from './onboardingEngine';
import { classifyTitle } from './categoryCatalog';

export interface PortfolioLine {
  productId: string;
  title: string;
  category: string;
  moq: number;
  orderQty: number;
  landedCostKrw: number;      // per unit
  orderCostKrw: number;       // qty × landedCost
  expectedSellKrw: number;    // qty × coupangPrice
  expectedProfitKrw: number;
  roiPercent: number;
  allocationPct: number;      // share of total capital assigned to this line
  feasible: boolean;
  note: string;
}

export interface PortfolioResult {
  capitalKrw: number;
  level: SellerLevel;
  deployRatio: number;
  deployBudgetKrw: number;
  cashReserveKrw: number;
  lines: PortfolioLine[];
  totals: {
    orderCostKrw: number;
    expectedSellKrw: number;
    expectedProfitKrw: number;
    expectedRoiPct: number;
    categoriesUsed: string[];
  };
  infeasible: { productId: string; reason: string }[];
  actionPlan: string[];
  generatedAt: string;
}

const DEPLOY_RATIO: Record<SellerLevel, number> = { beginner: 0.4, growth: 0.6, mature: 0.8 };
const MAX_LINES: Record<SellerLevel, number> = { beginner: 3, growth: 4, mature: 5 };

export async function buildPortfolio(input: {
  capitalKrw: number;
  level: SellerLevel;
  categories?: string[];
  /** User-adjusted allocation weights per category name (default: equal). */
  categoryWeights?: Record<string, number>;
  /** Categories the user explicitly excluded. */
  excludedCategories?: string[];
}): Promise<PortfolioResult> {
  const products = await queryProducts();
  const { capitalKrw, level } = input;
  const deployRatio = DEPLOY_RATIO[level];
  const deployBudgetKrw = Math.round(capitalKrw * deployRatio);
  const cashReserveKrw = capitalKrw - deployBudgetKrw;

  // 1. Score all products: snapshot + catalog category
  const scored: { p: any; snap: PriceSnapshot; category: string; moq: number }[] = [];
  for (const p of products) {
    const snap = await compareProduct(p);
    if (!snap || snap.roiPercent <= 0) continue;
    const meta = classifyTitle(p.title);
    scored.push({
      p,
      snap,
      category: meta?.name || '기타',
      moq: Number(p.dataJsonLd?.offers?.moq?.value) || 1,
    });
  }

  // 2. Filters: explicit categories, exclusions
  let pool = input.categories?.length
    ? scored.filter((s) => input.categories!.includes(s.category))
    : scored;
  if (input.excludedCategories?.length) {
    pool = pool.filter((s) => !input.excludedCategories!.includes(s.category));
  }

  // 3. Sort ROI desc; pick best per category (line = one product per category)
  pool.sort((a, b) => b.snap.roiPercent - a.snap.roiPercent);
  const bestByCategory = new Map<string, typeof pool[number]>();
  for (const s of pool) {
    if (!bestByCategory.has(s.category)) bestByCategory.set(s.category, s);
  }
  let candidates = [...bestByCategory.values()];

  // 4. Allocation: user weights if given, else equal — capped at MAX_LINES
  const weights: Record<string, number> = {};
  for (const c of candidates) {
    weights[c.category] = input.categoryWeights?.[c.category] ?? 1;
  }
  candidates = candidates
    .filter((c) => weights[c.category] > 0)
    .sort((a, b) => (weights[b.category] * b.snap.roiPercent) - (weights[a.category] * a.snap.roiPercent))
    .slice(0, MAX_LINES[level]);
  const weightSum = candidates.reduce((a, c) => a + weights[c.category], 0) || 1;

  // 5. MOQ-quantized order lines, budget proportional to weight
  const lines: PortfolioLine[] = [];
  const infeasible: { productId: string; reason: string }[] = [];
  for (const s of candidates) {
    const lineBudget = Math.floor(deployBudgetKrw * (weights[s.category] / weightSum));
    const unitCost = s.snap.landedCostKrw;
    const minCost = unitCost * s.moq;
    if (minCost > lineBudget) {
      infeasible.push({
        productId: s.p.productId,
        reason: `MOQ ${s.moq}개 최소비용 ₩${minCost.toLocaleString()} > 라인 예산 ₩${lineBudget.toLocaleString()}`,
      });
      continue;
    }
    const qty = Math.max(s.moq, Math.floor(lineBudget / unitCost));
    const orderCostKrw = qty * unitCost;
    const expectedSellKrw = qty * s.snap.coupangPriceKrw;
    const expectedProfitKrw = qty * s.snap.marginKrw;
    lines.push({
      productId: s.p.productId,
      title: s.p.title,
      category: s.category,
      moq: s.moq,
      orderQty: qty,
      landedCostKrw: unitCost,
      orderCostKrw,
      expectedSellKrw,
      expectedProfitKrw,
      roiPercent: s.snap.roiPercent,
      allocationPct: Math.round((orderCostKrw / capitalKrw) * 1000) / 10,
      feasible: true,
      note: `MOQ ${s.moq} → ${qty}개 발주 · 회전 시 이익 ₩${expectedProfitKrw.toLocaleString()}`,
    });
  }

  // 5. Totals
  const orderCostKrw = lines.reduce((a, l) => a + l.orderCostKrw, 0);
  const expectedSellKrw = lines.reduce((a, l) => a + l.expectedSellKrw, 0);
  const expectedProfitKrw = lines.reduce((a, l) => a + l.expectedProfitKrw, 0);
  const expectedRoiPct = orderCostKrw > 0 ? Math.round((expectedProfitKrw / orderCostKrw) * 1000) / 10 : 0;

  const actionPlan: string[] = [];
  if (lines.length > 0) {
    actionPlan.push(`1️⃣ 총 ₩${orderCostKrw.toLocaleString()} 발주 (자본의 ${Math.round((orderCostKrw / capitalKrw) * 100)}%), 예비비 ₩${cashReserveKrw.toLocaleString()} 확보`);
    actionPlan.push(`2️⃣ 각 라인 샘플 ${lines[0].moq}개 먼저 수령 → 품질·KC 서류 확인 후 본발주`);
    actionPlan.push(`3️⃣ 전량 회전(판매) 시 예상 이익 ₩${expectedProfitKrw.toLocaleString()} (투입 대비 ${expectedRoiPct}%)`);
    actionPlan.push(`4️⃣ 첫 회전 완료 후, 팔린 라인부터 수량 2배로 확대 — 안 팔린 라인은 교체`);
  } else {
    actionPlan.push('⚠️ 예산 내 발주 가능한 상품이 없습니다 — 자본 상향 또는 저MOQ 상품 적재가 필요합니다.');
  }

  logEvent('info', 'portfolio.built', {
    level, capitalKrw, lines: lines.length, orderCostKrw, expectedProfitKrw,
  });

  return {
    capitalKrw,
    level,
    deployRatio,
    deployBudgetKrw,
    cashReserveKrw,
    lines,
    totals: {
      orderCostKrw,
      expectedSellKrw,
      expectedProfitKrw,
      expectedRoiPct,
      categoriesUsed: [...new Set(lines.map((l) => l.category))],
    },
    infeasible,
    actionPlan,
    generatedAt: new Date().toISOString(),
  };
}
