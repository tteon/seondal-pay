/**
 * pricingEngine.ts — Tier pricing with REAL unit economics.
 *
 * Cost estimates come from our own measured experiments (Kimi K3 usage):
 *   - exp1: ontology-node analysis ≈ 430 prompt + ~200 completion tokens
 *   - exp2: role-decomposed deep reasoning ≈ 1,300–8,400 prompt + reasoning
 *     output tokens per product
 * K3 list prices: input $3.00/1M (miss) · $0.30/1M (hit) · output $15.00/1M.
 *
 * Rule: price = cost × target-margin multiplier, rounded to clean numbers.
 * Target gross margin ≥ 80% on every tier — we never sell reasoning at a loss.
 */

export interface TierPrice {
  tier: number;
  name: string;
  features: string[];
  reasoningLevel: 'none' | 'low' | 'high';
  estPromptTokens: number;
  estCompletionTokens: number;
  estCostUsd: number;     // measured-cost estimate per call
  priceUsd: number;       // recommended retail
  priceSol: number;       // demo/devnet rail price (current)
  marginPct: number;      // (price - cost) / price
}

const SOL_USD = parseFloat(process.env.SOL_USD_REFERENCE || '180');

function costUsd(prompt: number, completion: number, cacheHitRatio = 0.3): number {
  const hit = prompt * cacheHitRatio;
  const miss = prompt - hit;
  return (miss * 3.0 + hit * 0.3 + completion * 15.0) / 1e6;
}

function tier(t: Omit<TierPrice, 'estCostUsd' | 'priceUsd' | 'marginPct'>, marginTarget = 0.85): TierPrice {
  const est = costUsd(t.estPromptTokens, t.estCompletionTokens);
  const priceUsd = Math.max(0.01, Math.ceil((est / (1 - marginTarget)) * 100) / 100);
  return {
    ...t,
    estCostUsd: Math.round(est * 1e6) / 1e6,
    priceUsd,
    marginPct: Math.round(((priceUsd - est) / priceUsd) * 1000) / 10,
  };
}

export const PRICING_TABLE: TierPrice[] = [
  tier({
    tier: 1,
    name: 'Basic Metadata',
    features: ['상품 기본 스펙 (타이틀/가격/이미지)', 'JSON-LD 타입 노드', '광고 없는 API 응답'],
    reasoningLevel: 'none',
    estPromptTokens: 500,
    estCompletionTokens: 120,
    priceSol: 0.005,
  }),
  tier({
    tier: 2,
    name: 'Logistics & Landed Cost',
    features: ['Tier 1 전부', 'MOQ·무게·물류 스펙', '랜디드코스트 단건 계산'],
    reasoningLevel: 'low',
    estPromptTokens: 2200,
    estCompletionTokens: 450,
    priceSol: 0.015,
  }),
  tier({
    tier: 3,
    name: 'Deep Sourcing Reasoning',
    features: ['Tier 2 전부', '한국 벤치마크가·ROI 분석', '역할 에이전트 4인 추론 (분류/원가/규제/추천)', '관심 프로파일 라우팅'],
    reasoningLevel: 'high',
    estPromptTokens: 9000,
    estCompletionTokens: 2600,
    priceSol: 0.05,
  }),
];

export interface QueryDifficulty {
  level: 'simple' | 'standard' | 'deep';
  multiplier: number;
  note: string;
}

/** Difficulty surcharges — reasoning-heavy queries burn 5–10× output tokens. */
export const DIFFICULTY_MULTIPLIERS: QueryDifficulty[] = [
  { level: 'simple', multiplier: 1.0, note: '단건 조회/팩트 질의 (reasoning_effort=low)' },
  { level: 'standard', multiplier: 1.5, note: '비교/요약 분석 (저강도 추론)' },
  { level: 'deep', multiplier: 2.5, note: '멀티에이전트 종합 판단 (고강도 추론, 출력 토큰 5~10×)' },
];

export function priceFor(tierNum: number, difficulty: QueryDifficulty['level'] = 'simple'): {
  tier: TierPrice; difficulty: QueryDifficulty; finalPriceUsd: number; finalPriceSol: number; marginPct: number;
} {
  const t = PRICING_TABLE.find((x) => x.tier === tierNum) || PRICING_TABLE[2];
  const d = DIFFICULTY_MULTIPLIERS.find((x) => x.level === difficulty)!;
  const finalUsd = Math.round(t.priceUsd * d.multiplier * 100) / 100;
  const estCost = t.estCostUsd * (difficulty === 'deep' ? 6 : difficulty === 'standard' ? 2.5 : 1);
  return {
    tier: t,
    difficulty: d,
    finalPriceUsd: finalUsd,
    finalPriceSol: Math.round((finalUsd / SOL_USD) * 1e6) / 1e6,
    marginPct: Math.round(((finalUsd - estCost) / finalUsd) * 1000) / 10,
  };
}

/** Subscription overlay for heavy users (credits bundle vs pure per-call). */
export const SUBSCRIPTIONS = [
  {
    id: 'SELLER_PRO',
    priceKrwMonthly: 39000,
    includes: 'Tier 1 무제한 · Tier 2 월 500건 · Tier 3 월 100건 · 프로파일 알림',
    perCallEquivalent: 'Tier 3 단건 $0.25 → 구독 시 약 70% 절감 (월 100건 기준)',
  },
  {
    id: 'AGENCY',
    priceKrwMonthly: 290000,
    includes: 'SELLER_PRO 전부 · Tier 3 월 1,000건 · 프라이빗 프로파일 · 전용 Discord 채널',
    perCallEquivalent: '에이전시 다계정 운영 단가 최적화',
  },
];

/**
 * SaaS plans: signup base fee (기본료) + included credits + metered overage.
 * Category complexity multiplies overage (KC-heavy categories cost more to
 * reason about — compliance inference burns more tokens).
 */
export interface SaaSPlan {
  id: string;
  baseFeeKrwMonthly: number;
  included: { tier: number; calls: number }[];
  overageUsdPerCall: Record<string, number>; // key: `T${tier}` or `T${tier}:deep`
  categoryMultipliers: Record<string, number>;
  notes: string;
}

const DEFAULT_CATEGORY_MULTIPLIERS: Record<string, number> = {
  '유아 의류': 1.0,
  '유아 식기': 1.2,   // 식품위생법 판정 추론 비용
  '완구/용품': 1.2,   // 어린이제품 특별안전법
  '전자제품': 1.3,    // 전기안전 + 배터리 규제 추론
  '기타': 1.0,
};

export const SAAS_PLANS: SaaSPlan[] = [
  {
    id: 'FREE_TRIAL',
    baseFeeKrwMonthly: 0,
    included: [{ tier: 1, calls: 20 }, { tier: 3, calls: 3 }],
    overageUsdPerCall: { T1: 0.02, T2: 0.08, T3: 0.4, 'T3:deep': 1.0 },
    categoryMultipliers: DEFAULT_CATEGORY_MULTIPLIERS,
    notes: '가입 즉시 체험 크레딧 — 포트폴리오 1회 생성 포함',
  },
  {
    id: 'STARTER',
    baseFeeKrwMonthly: 9900,
    included: [{ tier: 1, calls: 200 }, { tier: 2, calls: 50 }, { tier: 3, calls: 10 }],
    overageUsdPerCall: { T1: 0.018, T2: 0.07, T3: 0.35, 'T3:deep': 0.9 },
    categoryMultipliers: DEFAULT_CATEGORY_MULTIPLIERS,
    notes: '초기 셀러 — cold-start 온볼딩 + 예산 포트폴리오 + Discord 알림',
  },
  {
    id: 'SELLER_PRO',
    baseFeeKrwMonthly: 39000,
    included: [{ tier: 1, calls: -1 }, { tier: 2, calls: 500 }, { tier: 3, calls: 100 }],
    overageUsdPerCall: { T2: 0.06, T3: 0.3, 'T3:deep': 0.8 },
    categoryMultipliers: DEFAULT_CATEGORY_MULTIPLIERS,
    notes: 'Tier 1 무제한 — 지속 비교(컴패레이터) 포함',
  },
  {
    id: 'AGENCY',
    baseFeeKrwMonthly: 290000,
    included: [{ tier: 1, calls: -1 }, { tier: 2, calls: -1 }, { tier: 3, calls: 1000 }],
    overageUsdPerCall: { T3: 0.25, 'T3:deep': 0.7 },
    categoryMultipliers: DEFAULT_CATEGORY_MULTIPLIERS,
    notes: '에이전시 — 다계정, 프라이빗 프로파일, 전용 채널',
  },
];
