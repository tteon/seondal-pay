/**
 * interestProfileEngine.ts — User interest profiles & opportunity routing
 *
 * A "category" for a seller is not just a product taxonomy — it is a
 * *financial profile*: ROI bands, margin density, acceptable risk.
 * Each profile defines what opportunities it wants; incoming opportunities
 * (paid scrapes, comparator sweeps) are scored against every profile and
 * routed (Discord) only where they fit.
 */
import { logEvent, profileMatches } from './observability';

export type RiskTolerance = 'low' | 'medium' | 'high';

export interface InterestProfile {
  profileId: string;
  displayName: string;
  /** Product taxonomy hints matched against title/category (case-insensitive) */
  categories: string[];
  /** Acceptable ROI% bands, inclusive [min, max] */
  roiBands: [number, number][];
  /** Minimum absolute margin in KRW */
  minMarginKrw: number;
  /** Max acceptable return-risk score 1~10 (10 = worst) */
  riskTolerance: RiskTolerance;
  channels: ('discord')[];
}

export interface Opportunity {
  productId: string;
  title: string;
  category?: string;
  roiPercent: number;
  marginKrw: number;
  returnRiskScore?: number; // 1~10, from tacit metrics when available
}

export interface ProfileMatch {
  profile: InterestProfile;
  score: number; // 0~100
  reasons: string[];
}

const RISK_MAX: Record<RiskTolerance, number> = { low: 3, medium: 6, high: 10 };

/**
 * Built-in profiles (persisted profiles can replace these later).
 * Financial categories first — taxonomy second — per product direction.
 */
export const INTEREST_PROFILES: InterestProfile[] = [
  {
    profileId: 'HIGH_MARGIN_HUNTER',
    displayName: '고마진 헌터 (ROI 60%+)',
    categories: [], // taxonomy-agnostic: margin is the category
    roiBands: [[60, 500]],
    minMarginKrw: 15000,
    riskTolerance: 'high',
    channels: ['discord'],
  },
  {
    profileId: 'STABLE_ROTATION',
    displayName: '안정 회전형 (ROI 30~60%, 저위험)',
    categories: [],
    roiBands: [
      [30, 60],
      [60, 90],
    ],
    minMarginKrw: 8000,
    riskTolerance: 'low',
    channels: ['discord'],
  },
  {
    profileId: 'BABYWEAR_EXPERT',
    displayName: '유아복 전문 셀러',
    categories: ['롬퍼', 'romper', '유아', '아기', 'baby', '아동복'],
    roiBands: [[25, 400]],
    minMarginKrw: 5000,
    riskTolerance: 'medium',
    channels: ['discord'],
  },
];

/** Score one opportunity against one profile. Null = hard-filtered out. */
export function matchOpportunity(
  profile: InterestProfile,
  opp: Opportunity
): ProfileMatch | null {
  // Hard filters
  const roiOk = profile.roiBands.some(([min, max]) => opp.roiPercent >= min && opp.roiPercent <= max);
  if (!roiOk) return null;
  if (opp.marginKrw < profile.minMarginKrw) return null;

  const risk = opp.returnRiskScore ?? 5;
  if (risk > RISK_MAX[profile.riskTolerance]) return null;

  // Score: ROI fit (50) + margin size (30) + category affinity (20)
  const widestBand = profile.roiBands[profile.roiBands.length - 1];
  const roiScore = Math.min(50, (opp.roiPercent / Math.max(widestBand[1], 1)) * 50);
  const marginScore = Math.min(30, (opp.marginKrw / (profile.minMarginKrw * 4)) * 30);

  let categoryScore = 0;
  const reasons: string[] = [];
  if (profile.categories.length === 0) {
    categoryScore = 20; // taxonomy-agnostic profile
    reasons.push('금융 프로파일 매칭 (분류 무관)');
  } else {
    const hay = `${opp.title} ${opp.category || ''}`.toLowerCase();
    const hits = profile.categories.filter((c) => hay.includes(c.toLowerCase()));
    categoryScore = hits.length > 0 ? 20 : 0;
    if (hits.length > 0) reasons.push(`관심 카테고리 매칭: ${hits.join(', ')}`);
  }

  reasons.push(`ROI ${opp.roiPercent.toFixed(1)}% ∈ 프로파일 밴드`);
  reasons.push(`마진 ${opp.marginKrw.toLocaleString()} KRW ≥ 최소 ${profile.minMarginKrw.toLocaleString()}`);

  return {
    profile,
    score: Math.round(roiScore + marginScore + categoryScore),
    reasons,
  };
}

/** Route one opportunity to all matching profiles, best first. */
export function routeOpportunity(opp: Opportunity): ProfileMatch[] {
  const matches = INTEREST_PROFILES
    .map((p) => matchOpportunity(p, opp))
    .filter((m): m is ProfileMatch => m !== null)
    .sort((a, b) => b.score - a.score);

  for (const m of matches) {
    profileMatches.inc({ profile: m.profile.profileId });
  }
  if (matches.length > 0) {
    logEvent('info', 'profile.opportunity_routed', {
      productId: opp.productId,
      matchedProfiles: matches.map((m) => m.profile.profileId),
      topScore: matches[0].score,
    });
  }
  return matches;
}

export function listProfiles(): InterestProfile[] {
  return INTEREST_PROFILES;
}
