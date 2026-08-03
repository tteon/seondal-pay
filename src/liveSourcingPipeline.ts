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
import { assessProductCompliance } from './complianceVerdictEngine';
import { computeMarketPie, computeEntryAnalysis } from './marketPieEngine';

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
    title: '🗄️ 상품 창고 확인',
    detail: `우리 데이터 창고에 쌓인 상품 ${products.length}건을 먼저 살펴서, 질문과 가장 가까운 후보를 찾습니다.`,
    data: { count: products.length },
    durationMs: Date.now() - t0,
  });

  const candidate = pickCandidate(products, query);
  if (!candidate) {
    // No catalog match → pivot to market-pie analysis for the keyword
    const pie = computeMarketPie(query);
    steps.push({
      step: 2,
      key: 'catalog.empty',
      title: '🔍 창고에 없는 상품 — 대신 시장 파이 분석',
      detail: pie.top.length > 0
        ? `'${query}' 상품은 아직 우리 창고에 없어요. 대신 쿠팡 시장 데이터로 이 시장의 구조를 보여드릴게요.`
        : `'${query}'은 창고에도 시장 데이터에도 없어요. OpenClaw로 쿠팡 가격·판매량을 먼저 수집해 주세요.`,
      data: { query },
    });
    if (pie.top.length > 0) {
      steps.push({
        step: 3,
        key: 'marketpie.overview',
        title: '🥧 시장 파이 (TOP 판매자 점유율)',
        detail: pie.top.slice(0, 3).map((e) =>
          `${e.rank}위 ${e.productName.slice(0, 18)}… ₩${e.priceKrw.toLocaleString()} (월 ${e.monthlySales.toLocaleString()}건, ${e.sharePercent}%)`
        ).join(' · '),
        data: pie,
      });
      // Estimate our landed cost from incumbent prices (cross-border typical
      // cost ≈ 40% of retail — documented assumption for the guide)
      const estLanded = Math.round(pie.priceMedianKrw * 0.4 / 100) * 100;
      const entry = computeEntryAnalysis(query, estLanded, 30);
      steps.push({
        step: 4,
        key: 'marketpie.entry',
        title: '🚪 이 시장 진입 판정',
        detail: entry.guide + ` (추정 원가 ₩${estLanded.toLocaleString()} — 현재가의 약 40% 가정, 실제 도매가 확인 필요)`,
        data: entry,
      });
      const best = entry.candidates.find((c) => c.feasible);
      const report = {
        productId: `market-${query}`,
        title: `${query} (시장 분석)`,
        wholesalePriceUsd: 0,
        landedCostKrw: estLanded,
        coupangPriceKrw: pie.priceMedianKrw,
        marginKrw: best ? best.marginKrw : 0,
        roiPercent: best ? best.roiPercent : 0,
        matchedProfiles: [],
        recommendation: entry.guide,
        challengeId: 'market-analysis',
        externalId: 'market-analysis',
      };
      steps.push({
        step: 5,
        key: 'report.card',
        title: '📋 시장 분석 리포트',
        detail: entry.guide,
        data: report,
      });
      return { query, startedAt, finishedAt: new Date().toISOString(), steps, report };
    }
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
    title: '💳 데이터 사용료 안내',
    detail: `이 분석 데이터는 유료예요 — ${tierPrice} SOL(수십 원 수준). 5분 안에 결제해야 하고, 결제 증명은 블록체인에 함께 기록돼서 나중에 누구든 확인할 수 있어요.`,
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
    title: '🧬 상품 정보 표준 카드화',
    detail: `웹페이지 원문(광고·추천 잡동사니) 대신, 판단에 필요한 정볧만 담은 표준 카드로 변환해요 — ${typedProps.length}가지 속성(최소주문수량·무게·공장위치·재질·기준가). AI가 헷갈리지 않게 하는 장치예요.`,
    data: {
      '@type': jsonLd['@type'] || 'Product',
      moq: jsonLd.offers?.moq?.value,
      typedAttributes: typedProps,
    },
    durationMs: Date.now() - t0,
  });

  // 3.5 Regulatory guardrail (deterministic 1차 검증 — LLM 환각 없이)
  t0 = Date.now();
  const compliance = assessProductCompliance(candidate.title || '', JSON.stringify(jsonLd));
  steps.push({
    step: 4,
    key: 'compliance.guardrail',
    title: '🛡️ 수입 규제 사전 확인',
    detail: `${compliance.verdictLabel} — ${compliance.agenciesInvolved.length ? compliance.agenciesInvolved.join('+') : '표시사항만 지키면 OK'} · 예상 비용 ₩${compliance.totalEstimatedCostKrw.min.toLocaleString()}~${compliance.totalEstimatedCostKrw.max.toLocaleString()} / 기간 ${compliance.totalEstimatedWeeks.min}~${compliance.totalEstimatedWeeks.max}주`,
    data: {
      verdict: compliance.verdict,
      requirements: compliance.requirements.map((r) => ({
        ruleId: r.ruleId, agency: r.agency, requirementName: r.requirementName,
        severity: r.severity, cost: r.estimatedCostKrw, weeks: r.estimatedWeeks,
      })),
      reasoningChain: compliance.reasoningChain,
    },
    durationMs: Date.now() - t0,
  });

  // 5. Comparator margin analysis — the Coupang seller's estimated economics
  t0 = Date.now();
  const snap = await compareProduct(candidate);
  if (snap) {
    const srcLabel =
      snap.coupangSource === 'observed' ? '실제 수집가' :
      snap.coupangSource === 'partners-api' ? '쿠팡 공식 API' : '유사 상품 평균가';
    steps.push({
      step: 5,
      key: 'comparator.margin',
      title: '⚖️ 쿠팡 판매자 예상 수익 구조',
      detail: `이 상품을 파는 쿠팡 셀러 기준으로 계산해 볼게요. 판매가 ₩${snap.coupangPriceKrw.toLocaleString()} [${srcLabel}]에서 쿠팡 수수료 ₩${snap.coupangFeeKrw.toLocaleString()}와 배송비 ₩${snap.coupangShippingFeeKrw.toLocaleString()}를 빼면 손에 남는 돈은 ₩${snap.netRevenueKrw.toLocaleString()}. 여기서 수입 원가 ₩${snap.landedCostKrw.toLocaleString()}(도매가+배송+관세)를 빼면, 예상 마진은 ₩${snap.marginKrw.toLocaleString()} (수익률 ${snap.roiPercent}%)예요.`,
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
    step: 6,
    key: 'profile.routing',
    title: '🎯 어떤 셀러에게 맞는 상품인지',
    detail: matches.length > 0
      ? matches.map((m) => `${m.profile.displayName} (적합도 ${m.score}점)`).join(' · ')
      : '지금 기준에 맞는 셀러 유형이 없어요 (수익률·마진 기준 미달)',
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
            ? `✅ 들여오기 추천 — 수익률 ${snap.roiPercent}%, 개당 예상 마진 ₩${snap.marginKrw.toLocaleString()}. ${matches[0].profile.displayName} 유형에 딱 맞아요.`
            : `⚠️ 이번엔 보류 — 수익률 ${snap.roiPercent}%는 기준에 못 미쳐요. 원가를 더 낮추거나 다른 상품을 보세요.`,
        challengeId: challenge.id,
        externalId: challenge.chargeRequest.externalId,
      }
    : null;

  steps.push({
    step: 7,
    key: 'report.card',
    title: '📋 최종 소싱 리포트',
    detail: report ? report.recommendation : '리포트 생성 불가 (마진 데이터 없음)',
    data: report,
  });

  return { query, startedAt, finishedAt: new Date().toISOString(), steps, report };
}
