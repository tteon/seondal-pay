/**
 * onboardingEngine.ts — Cold-start: profile → budget-feasible recommendations
 *
 * When a seller first signs up we capture: available capital (KRW), seller
 * level (beginner/growth/mature), and their Solana wallet (linked, shown in
 * the console). Recommendations are filtered by EXECUTABILITY first
 * (landedCost × MOQ ≤ capital) and then scored by level-appropriate risk:
 * beginners get low-risk stable-ROI items, not the highest-ROI ones.
 */
import { queryProducts } from './db';
import { compareProduct } from './comparatorEngine';
import { INTEREST_PROFILES, matchOpportunity, InterestProfile } from './interestProfileEngine';
import { logEvent } from './observability';

export type SellerLevel = 'beginner' | 'growth' | 'mature';

export interface OnboardingProfile {
  userId: string;
  displayName: string;
  capitalKrw: number;
  level: SellerLevel;
  walletAddress: string;
  createdAt: string;
}

export interface RecommendedItem {
  productId: string;
  title: string;
  priceUsd: number;
  moq: number;
  landedCostKrw: number;
  coupangPriceKrw: number;
  marginKrw: number;
  roiPercent: number;
  minOrderCostKrw: number;      // landedCost × MOQ — the cash needed for the first order
  capitalFitPct: number;        // minOrderCost / capital — how much of the budget the first order uses
  matchedProfile: { profileId: string; displayName: string; score: number } | null;
  reason: string;
}

export interface OnboardingResult {
  profile: OnboardingProfile;
  recommendations: RecommendedItem[];
  excluded: { productId: string; reason: string }[];
  guidance: string;
}

// In-memory demo store (keyed by userId)
const profiles = new Map<string, OnboardingProfile>();

/** Level → interest profile mapping (risk posture by experience). */
function levelProfile(level: SellerLevel): InterestProfile {
  switch (level) {
    case 'beginner':
      return INTEREST_PROFILES.find((p) => p.profileId === 'STABLE_ROTATION')!;
    case 'growth':
      return INTEREST_PROFILES.find((p) => p.profileId === 'BABYWEAR_EXPERT')!;
    case 'mature':
      return INTEREST_PROFILES.find((p) => p.profileId === 'HIGH_MARGIN_HUNTER')!;
  }
}

const LEVEL_GUIDANCE: Record<SellerLevel, string> = {
  beginner: '첫 회전은 무조건 소액·저위험으로. 자본의 30% 이상을 한 상품에 쓰지 마세요. ROI 30~60% 안정 구간 2~3개 분산이 생존 전략입니다.',
  growth: '검증된 카테고리에서 물량을 늘리되, 신규 카테고리는 자본의 20% 이내 테스트로.',
  mature: '고마진 밀도(무게당 마진) 우선. RCEP Form E 가능 공급처를 우선 협상하세요 — 관세 8%가 곧 순마진입니다.',
};

export async function createOnboardingProfile(input: {
  userId: string;
  displayName?: string;
  capitalKrw: number;
  level: SellerLevel;
  walletAddress: string;
}): Promise<OnboardingResult> {
  const profile: OnboardingProfile = {
    userId: input.userId,
    displayName: input.displayName || input.userId,
    capitalKrw: input.capitalKrw,
    level: input.level,
    walletAddress: input.walletAddress,
    createdAt: new Date().toISOString(),
  };
  profiles.set(profile.userId, profile);
  logEvent('info', 'onboarding.profile_created', {
    userId: profile.userId, level: profile.level, capitalKrw: profile.capitalKrw,
  });
  return buildRecommendations(profile);
}

export function getProfile(userId: string): OnboardingProfile | undefined {
  return profiles.get(userId);
}

export async function buildRecommendations(profile: OnboardingProfile): Promise<OnboardingResult> {
  const products = await queryProducts();
  const targetProfile = levelProfile(profile.level);
  const recommendations: RecommendedItem[] = [];
  const excluded: { productId: string; reason: string }[] = [];

  for (const p of products) {
    const snap = compareProduct(p);
    if (!snap) {
      excluded.push({ productId: p.productId, reason: '마진 데이터 부족 (벤치마크가 없음)' });
      continue;
    }
    const moq = p.dataJsonLd?.offers?.moq?.value || 1;
    const minOrderCostKrw = snap.landedCostKrw * moq;

    // ① Executability gate: first order must fit the budget (beginner: ≤30% of capital)
    const budgetCap = profile.level === 'beginner' ? 0.3 : profile.level === 'growth' ? 0.5 : 0.8;
    if (minOrderCostKrw > profile.capitalKrw * budgetCap) {
      excluded.push({
        productId: p.productId,
        reason: `초기 주문비 ₩${minOrderCostKrw.toLocaleString()} > 자본 한도 ₩${Math.round(profile.capitalKrw * budgetCap).toLocaleString()} (자본의 ${Math.round(budgetCap * 100)}% 룰)`,
      });
      continue;
    }

    // ② Profile fit scoring
    const match = matchOpportunity(targetProfile, {
      productId: p.productId,
      title: p.title,
      category: p.dataJsonLd?.category,
      roiPercent: snap.roiPercent,
      marginKrw: snap.marginKrw,
    });

    const capitalFitPct = Math.round((minOrderCostKrw / profile.capitalKrw) * 100);
    recommendations.push({
      productId: p.productId,
      title: p.title,
      priceUsd: p.price,
      moq,
      landedCostKrw: snap.landedCostKrw,
      coupangPriceKrw: snap.coupangPriceKrw,
      marginKrw: snap.marginKrw,
      roiPercent: snap.roiPercent,
      minOrderCostKrw,
      capitalFitPct,
      matchedProfile: match
        ? { profileId: targetProfile.profileId, displayName: targetProfile.displayName, score: match.score }
        : null,
      reason: match
        ? `${targetProfile.displayName} 적합 (score ${match.score}) · 초기 주문 자본의 ${capitalFitPct}% 사용`
        : `실행 가능하나 프로파일 기준치 미달 (ROI ${snap.roiPercent}%)`,
    });
  }

  // Executability first, then ROI within the feasible set
  recommendations.sort((a, b) => {
    const profDelta = (b.matchedProfile?.score || 0) - (a.matchedProfile?.score || 0);
    return profDelta !== 0 ? profDelta : b.roiPercent - a.roiPercent;
  });

  logEvent('info', 'onboarding.recommendations_built', {
    userId: profile.userId,
    recommended: recommendations.length,
    excluded: excluded.length,
  });

  return {
    profile,
    recommendations,
    excluded,
    guidance: LEVEL_GUIDANCE[profile.level],
  };
}
