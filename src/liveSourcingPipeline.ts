/**
 * liveSourcingPipeline.ts — Demo chat backend: the REAL pipeline, step by step.
 *
 * When a user asks in the chat UI (e.g. "유아 롬퍼 소싱해줘"), this runs the
 * actual platform stages and returns them as an ordered step list plus a
 * SaaS-style report card — so the demo video shows the system working, not
 * a canned script:
 *
 *   1. catalog scan      — queryProducts() (Cloud SQL via proxy / mock)
 *   2. mpp.challenge     — real 402 challenge issued via mppEngine
 *   3. ontology.typing   — product JSON-LD node (Rule 2.1 payload)
 *   4. comparator.margin — landed cost / margin / ROI (comparatorEngine)
 *   5. profile.routing   — interest-profile matches (interestProfileEngine)
 *   6. report            — SaaS report card (also what Discord would carry)
 */
import { queryProducts } from './db';
import { issueChallenge, activeChallengeCount } from './mppEngine';
import { compareProduct } from './comparatorEngine';
import { routeOpportunity } from './interestProfileEngine';

export interface PipelineStep {
  step: number;
  key: string;
  title: string;
  detail: string;
  data?: any;
  durationMs?: number;
}

export interface LiveSourcingResult {
  query: string;
  startedAt: string;
  finishedAt: string;
  steps: PipelineStep[];
  report: {
    productId: string;
    title: string;
    wholesalePriceUsd: number;
    landedCostKrw: number;
    coupangPriceKrw: number;
    marginKrw: number;
    roiPercent: number;
    matchedProfiles: { profileId: string; displayName: string; score: number }[];
    recommendation: string;
    challengeId: string;
    externalId: string;
  } | null;
}

const MERCHANT_WALLET = process.env.MERCHANT_WALLET_PUBKEY || 'Egu2emsyGRopY3cXF3N1Ywxm7ehqaENbFSeBkrXat7F8';

/** Pick the best catalog candidate for a query (keyword hit, else top-ROI). */
function pickCandidate(products: any[], query: string): any | null {
  if (products.length === 0) return null;
  const q = query.toLowerCase();
  const hit = products.find((p) =>
    (p.title || '').toLowerCase().includes(q) ||
    q.split(/\s+/).some((tok) => tok.length >= 2 && (p.title || '').toLowerCase().includes(tok))
  );
  return hit || products[0];
}

export async function runLiveSourcingPipeline(query: string, tier = 3): Promise<LiveSourcingResult> {
  const startedAt = new Date().toISOString();
  const steps: PipelineStep[] = [];

  // 1. Catalog scan
  let t0 = Date.now();
  const products = await queryProducts();
  steps.push({
    step: 1,
    key: 'catalog.scan',
    title: '🗄️ 카탈로그 스캔',
    detail: `Cloud SQL(PostgreSQL)에 적재된 상품 ${products.length}건 조회`,
    data: { count: products.length },
    durationMs: Date.now() - t0,
  });

  const candidate = pickCandidate(products, query);
  if (!candidate) {
    steps.push({ step: 2, key: 'catalog.empty', title: '⚠️ 후보 없음', detail: '카탈로그가 비어 있습니다. /api/scrape 결제 플로우로 상품을 먼저 적재하세요.' });
    return { query, startedAt, finishedAt: new Date().toISOString(), steps, report: null };
  }

  // 2. MPP challenge (real issuance — the payment rail the agent would face)
  t0 = Date.now();
  const tierPrice = tier === 1 ? 0.005 : tier === 2 ? 0.015 : 0.05;
  const challenge = issueChallenge({
    id: `DEMO-${Date.now()}`,
    recipient: MERCHANT_WALLET,
    tier,
    amountSol: tierPrice,
    realm: process.env.MPP_REALM || 'seocho-pay',
    description: `Tier ${tier} sourcing analysis for '${query}'`,
  });
  steps.push({
    step: 2,
    key: 'mpp.challenge',
    title: '💳 MPP 402 챌린지 발행',
    detail: `Tier ${tier} 데이터 접근권 — ${tierPrice} SOL · TTL 300초 · externalId는 온체인 Memo로 바인딩`,
    data: {
      challengeId: challenge.id,
      amountLamports: challenge.chargeRequest.amount,
      externalId: challenge.chargeRequest.externalId,
      expires: challenge.expires,
      activeChallenges: activeChallengeCount(),
    },
    durationMs: Date.now() - t0,
  });

  // 3. Ontology typing (Rule 2.1 payload view)
  t0 = Date.now();
  const jsonLd = candidate.dataJsonLd || {};
  const typedProps = (jsonLd.additionalProperty || []).map((p: any) => p.name);
  steps.push({
    step: 3,
    key: 'ontology.typing',
    title: '🧬 온톨로지 타이핑 (Rule 2.1)',
    detail: `원시 텍스트 대신 schema.org/Product 정합 타입드 노드만 A2A로 전달 — 속성 ${typedProps.length}종`,
    data: {
      '@type': jsonLd['@type'] || 'Product',
      moq: jsonLd.offers?.moq?.value,
      typedAttributes: typedProps,
    },
    durationMs: Date.now() - t0,
  });

  // 4. Comparator margin analysis — the Coupang seller's estimated economics
  t0 = Date.now();
  const snap = await compareProduct(candidate);
  if (snap) {
    const srcLabel =
      snap.coupangSource === 'observed' ? '쿠팡 실측(수집)' :
      snap.coupangSource === 'partners-api' ? 'Coupang API 실측' : '벤치마크(합성)';
    steps.push({
      step: 4,
      key: 'comparator.margin',
      title: '⚖️ 쿠팡 판매자 추정 경제 분석',
      detail: `이 상품을 파는 쿠팡 셀러의 추정 구조 — 판매가 ₩${snap.coupangPriceKrw.toLocaleString()} [${srcLabel}] − 수수료 ₩${snap.coupangFeeKrw.toLocaleString()} − 배송 ₩${snap.coupangShippingFeeKrw.toLocaleString()} = 순수익 ₩${snap.netRevenueKrw.toLocaleString()} · 원가(랜디드) ₩${snap.landedCostKrw.toLocaleString()} → 추정 마진 ₩${snap.marginKrw.toLocaleString()} (${snap.roiPercent}%)`,
      data: snap,
      durationMs: Date.now() - t0,
    });
  }

  // 5. Interest-profile routing
  t0 = Date.now();
  const matches = snap
    ? routeOpportunity({
        productId: snap.productId,
        title: snap.title,
        category: jsonLd.category,
        roiPercent: snap.roiPercent,
        marginKrw: snap.marginKrw,
      })
    : [];
  steps.push({
    step: 5,
    key: 'profile.routing',
    title: '🎯 관심 프로파일 라우팅',
    detail: matches.length > 0
      ? matches.map((m) => `${m.profile.displayName} (score ${m.score})`).join(' · ')
      : '매칭 프로파일 없음 (ROI 밴드/마진 기준 미달)',
    data: matches.map((m) => ({ profileId: m.profile.profileId, score: m.score, reasons: m.reasons })),
    durationMs: Date.now() - t0,
  });

  // 6. SaaS report card
  const report = snap
    ? {
        productId: snap.productId,
        title: snap.title,
        wholesalePriceUsd: snap.chinaWholesaleUsd,
        landedCostKrw: snap.landedCostKrw,
        coupangPriceKrw: snap.coupangPriceKrw,
        marginKrw: snap.marginKrw,
        roiPercent: snap.roiPercent,
        matchedProfiles: matches.map((m) => ({
          profileId: m.profile.profileId,
          displayName: m.profile.displayName,
          score: m.score,
        })),
        recommendation:
          matches.length > 0 && snap.roiPercent >= 30
            ? `✅ 소싱 추천 — ROI ${snap.roiPercent}%, 마진 ₩${snap.marginKrw.toLocaleString()}. ${matches[0].profile.displayName} 프로파일 적합.`
            : `⚠️ 보류 — ROI ${snap.roiPercent}%는 프로파일 기준 미달입니다.`,
        challengeId: challenge.id,
        externalId: challenge.chargeRequest.externalId,
      }
    : null;

  steps.push({
    step: 6,
    key: 'report.card',
    title: '📋 소싱 리포트 생성',
    detail: report ? report.recommendation : '리포트 생성 불가 (마진 데이터 없음)',
    data: report,
  });

  return { query, startedAt, finishedAt: new Date().toISOString(), steps, report };
}
