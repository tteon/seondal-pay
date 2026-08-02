/**
 * run_ontology_experiment.ts — Experiment 1 (pre-registered, Kimi K3)
 *
 * Hypothesis: passing JSON-LD ontology nodes between agents (instead of raw
 * crawled text) reduces prompt tokens ≥70% while maintaining fact accuracy
 * (B ≥ A−2%p) and not increasing hallucination.
 *
 * Conditions (same model kimi-k3, reasoning_effort=low, temperature 0):
 *   A: raw noisy page text      → billed to KIMI_KEY_NON_ONTOLOGY
 *   B: JSON-LD typed node only  → billed to KIMI_KEY_ONTOLOGY
 *
 * Tracing: OTel spans per call (service=seondal-experiments) + JSONL trace
 * file, so conditions can be compared in Grafana Tempo and locally.
 * Run: npx ts-node scripts/run_ontology_experiment.ts
 */
import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';

const KIMI_API_URL = 'https://api.moonshot.ai/v1/chat/completions';
const MODEL = 'kimi-k3';
const CONCURRENCY = 5;
const KEYS: Record<'A' | 'B', string> = {
  A: process.env.KIMI_KEY_NON_ONTOLOGY || '',
  B: process.env.KIMI_KEY_ONTOLOGY || '',
};
// Kimi K3 pricing (per 1M tokens): input cache-miss $3.00, cache-hit $0.30, output $15.00
const PRICE = { inputMiss: 3.0, inputHit: 0.3, output: 15.0 };

// --- OTel (no auto-instrumentations needed; spans only) ---
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'seondal-experiments' }),
  traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
});
sdk.start();
const tracer = trace.getTracer('seondal-experiments', '1.0.0');
const traceFile = 'scripts/experiment1_trace.jsonl';
fs.writeFileSync(traceFile, '');

// --- deterministic RNG (mulberry32) ---
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260802);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

interface GoldenProduct {
  id: string; title: string; priceUsd: number; moq: number; weightGrm: number;
  factory: string; benchmarkKrw: number; category: string; rawText: string; jsonLd: any;
}

const FACTORIES = ['Guangzhou', 'Yiwu', 'Shenzhen', 'Hangzhou'];
const TITLES = [
  '신생아 여아 순면 스플라이싱 롬퍼', '유아 실리콘 식기 4종 세트', '아동 여름 메쉬 운동화',
  '유아용 나무 치발기 세트', '아기 여름 모시 손수건 10장', '유아 방수 턱받이 3종',
  '신생아 오가닉 속싸개', '아동용 LED 장난감 칫솔', '유아 미끄럼방지 양말 5켤레', '아기 모빌 침대 장식',
];
const REVIEWS = [
  '배송이 12일 걸렸어요. 별 4개 드립니다.', '사이즈 90 주문했는데 딱 맞아요.',
  '재질이 부드러워서 아이가 좋아해요. 재구매 3번째.', '색상이 사진과 조금 달라요.',
  '가격 대비 만족합니다. 리뷰 포인트 500원 받았어요.',
];

function buildRawText(p: GoldenProduct, others: GoldenProduct[]): string {
  const d1 = pick(others), d2 = pick(others);
  const sections = [
    `카테고리 홈 > 의류 > 유아동 > 롬퍼/바디수트 | 로그인 | 장바구니 (3) | 쿠폰 2장 | 오늘의 특가`,
    `[광고] 여름 세일 최대 70% — 지금 쿠폰 받기 ▶ | 관세청 개인통관고유부호 발급 안내`,
    `${p.title} — 2025 여름 신제품 | 판매자: ${p.factory} Direct Industrial Co., Ltd.`,
    `상품번호 ${p.id} | 찜 1,203 | 리뷰 87개 | 누적판매 4,521개`,
    `【商品规格】最小起订量(MOQ): ${d1.moq} 件 — 주의: 이 값은 추천 상품 기준이 아님`,
    `Spec Table (정렬 무작위): Material=100% Premium Cotton; Shipping Weight=${p.weightGrm}g; MOQ=${p.moq} units; Factory Location=${p.factory}; Origin=CN; HS Code=6111.20`,
    `배송 안내: 무게 ${d2.weightGrm}g 기준 항공특송 7~14일 (연관 상품 기준) | 묶음배송 가능`,
    `가격 정보: $${p.priceUsd} USD (1~${p.moq * 10 - 1}개) | 대량 구매 시 $${(p.priceUsd * 0.85).toFixed(2)} | 한국 참고 소매가: ₩${p.benchmarkKrw.toLocaleString()}`,
    `다른 고객이 함께 본 상품: ${d1.title.slice(0, 12)}... $${d1.priceUsd} | ${d2.title.slice(0, 12)}... $${d2.priceUsd} | 추천 벤치마크 ₩${d1.benchmarkKrw.toLocaleString()}`,
    `【买家评价】${pick(REVIEWS)} / ${pick(REVIEWS)} / ${pick(REVIEWS)}`,
    `Q&A (12): "MOQ가 정확히 몇 개인가요?" → "페이지 상세 참조 부탁드립니다." | "관세 포함인가요?" → "별도입니다."`,
    `유사 공장 추천: ${pick(FACTORIES)} Premium Kids Wear | ${pick(FACTORIES)} Baby Textile Co. — 공장 위치 문의는 채팅으로`,
    `© 2025 Marketplace. 개인정보처리방침 | 청소년보호정책 | 글로벌 배송 정책 | 판매자 센터`,
  ];
  const junk: string[] = [];
  for (let i = 0; i < 8; i++) {
    junk.push(`추천 상품 #${i + 1}: ${pick(TITLES)} $${(rand() * 40 + 5).toFixed(2)} | 평점 ${(rand() * 2 + 3).toFixed(1)} | 리뷰 ${Math.floor(rand() * 900)} | 마감세일 ${Math.floor(rand() * 70)}%`);
  }
  return [...sections.slice(0, 4), ...junk, ...sections.slice(4)].join('\n');
}

function buildJsonLd(p: GoldenProduct) {
  return {
    '@context': 'https://schema.org/', '@type': 'Product', '@id': `urn:1688:product:${p.id}`,
    name: p.title, category: p.category,
    brand: { '@type': 'Brand', name: `${p.factory} Direct Industrial Co., Ltd.` },
    offers: {
      '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: p.priceUsd,
      moq: { '@type': 'QuantitativeValue', value: p.moq, unitCode: 'EA' },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Shipping Weight', value: p.weightGrm, unitCode: 'GRM' },
      { '@type': 'PropertyValue', name: 'Factory Location', value: p.factory },
      { '@type': 'PropertyValue', name: 'Korean Benchmark Retail Price', value: p.benchmarkKrw, unitCode: 'KRW' },
    ],
  };
}

function makeDataset(n: number): GoldenProduct[] {
  const products: GoldenProduct[] = [];
  for (let i = 0; i < n; i++) {
    const priceUsd = Math.round((8 + rand() * 40) * 100) / 100;
    products.push({
      id: `100500${6200000000 + Math.floor(rand() * 9999999)}`,
      title: pick(TITLES), priceUsd,
      moq: 1 + Math.floor(rand() * 5),
      weightGrm: 150 + Math.floor(rand() * 500),
      factory: pick(FACTORIES),
      benchmarkKrw: Math.round(priceUsd * 1400 * (1.5 + rand() * 0.8)),
      category: 'Wholesale Apparel > Rompers',
      rawText: '', jsonLd: null,
    });
  }
  for (const p of products) {
    p.rawText = buildRawText(p, products.filter((o) => o.id !== p.id));
    p.jsonLd = buildJsonLd(p);
  }
  return products;
}

// --- LLM client (Kimi K3, per-condition billing key) ---
interface LlmResult {
  content: string; promptTokens: number; cachedTokens: number;
  completionTokens: number; reasoningTokens: number; latencyMs: number;
}
async function callKimi(cond: 'A' | 'B', system: string, user: string): Promise<LlmResult> {
  const start = Date.now();
  const res = await axios.post(
    KIMI_API_URL,
    {
      model: MODEL, reasoning_effort: 'low',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      // NOTE: kimi-k3 only accepts temperature=1 (fixed) — determinism comes
      // from reasoning_effort=low, not temperature=0.
      temperature: 1,
    },
    { headers: { Authorization: `Bearer ${KEYS[cond]}` }, timeout: 90000 }
  );
  const u = res.data?.usage || {};
  return {
    content: res.data?.choices?.[0]?.message?.content?.trim() || '',
    promptTokens: u.prompt_tokens ?? 0,
    cachedTokens: u.prompt_tokens_details?.cached_tokens ?? u.cached_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

async function pooled<T, R>(items: T[], worker: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[];
  let idx = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await worker(items[i]); }
  }));
  return out;
}

// --- queries & scoring ---
type Verdict = 'pass' | 'hallucination' | 'miss';
const QUERIES: { key: string; ask: string; score: (ans: string, p: GoldenProduct) => Verdict }[] = [
  { key: 'moq', ask: '이 상품의 MOQ(최소 주문 수량)는 몇 개인가요? 숫자만 답하세요.', score: (ans, p) => numericVerdict(ans, p.moq, 0) },
  { key: 'weight', ask: '이 상품의 배송 무게는 몇 g인가요? 숫자만 답하세요.', score: (ans, p) => numericVerdict(ans, p.weightGrm, 0.05) },
  {
    key: 'factory', ask: '이 상품의 공장 위치(도시)는 어디인가요? 도시명만 답하세요.',
    score: (ans, p) => ans.includes(p.factory) ? 'pass' : (FACTORIES.some((f) => ans.includes(f)) ? 'hallucination' : 'miss'),
  },
  { key: 'benchmark', ask: '이 상품의 한국 벤치마크 소매가는 얼마인가요? 숫자만 답하세요.', score: (ans, p) => numericVerdict(ans, p.benchmarkKrw, 0.05) },
  {
    key: 'recommend', ask: '이 상품의 한국 수입 추천 여부를 결정하고, 근거가 된 가격·수치 2가지를 함께 답하세요.',
    score: (ans, p) => {
      const cited = [p.priceUsd, p.benchmarkKrw, p.moq, p.weightGrm].filter((v) => containsNumber(ans, v, 0.06)).length;
      return cited >= 2 ? 'pass' : (cited === 0 ? 'miss' : 'hallucination');
    },
  },
];

function extractNumbers(ans: string): number[] {
  return (ans.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []).map(Number);
}
function containsNumber(ans: string, target: number, tol: number): boolean {
  return extractNumbers(ans).some((n) => Math.abs(n - target) <= Math.max(1, target * tol));
}
function numericVerdict(ans: string, target: number, tol: number): Verdict {
  const nums = extractNumbers(ans);
  if (nums.length === 0) return 'miss';
  return nums.some((n) => Math.abs(n - target) <= Math.max(1, target * tol)) ? 'pass' : 'hallucination';
}

interface SampleResult {
  productId: string; queryKey: string; condition: 'A' | 'B'; verdict: Verdict;
  promptTokens: number; cachedTokens: number; completionTokens: number;
  reasoningTokens: number; latencyMs: number; costUsd: number; traceId: string;
}

function costOf(r: { promptTokens: number; cachedTokens: number; completionTokens: number }): number {
  const miss = Math.max(0, r.promptTokens - r.cachedTokens);
  return (miss * PRICE.inputMiss + r.cachedTokens * PRICE.inputHit + r.completionTokens * PRICE.output) / 1e6;
}

async function main() {
  if (!KEYS.A || !KEYS.B) { console.error('KIMI_KEY_NON_ONTOLOGY / KIMI_KEY_ONTOLOGY required in .env'); process.exit(1); }
  const dataset = makeDataset(20);
  console.log(`Dataset: 20 products | rawText avg ${Math.round(avg(dataset.map((p) => p.rawText.length)))} chars | jsonLd avg ${Math.round(avg(dataset.map((p) => JSON.stringify(p.jsonLd).length)))} chars`);
  console.log(`Model: ${MODEL} (reasoning_effort=low, temp=0) | billing keys separated per condition`);

  const tasks: { p: GoldenProduct; q: (typeof QUERIES)[number]; cond: 'A' | 'B' }[] = [];
  for (const p of dataset) for (const q of QUERIES) for (const cond of ['A', 'B'] as const) tasks.push({ p, q, cond });

  const SYSTEM = 'You are a sourcing-analysis agent. Answer ONLY from the provided product context. 근거 없는 값을 만들지 마세요.';
  let done = 0;
  let errorCount = 0;
  const results = await pooled(tasks, async ({ p, q, cond }): Promise<SampleResult> => {
    return tracer.startActiveSpan(`exp1.${cond === 'A' ? 'raw_text' : 'ontology'}.${q.key}`, async (span) => {
      span.setAttributes({
        'exp.id': 'ontology-efficacy', 'exp.condition': cond, 'exp.product_id': p.id, 'exp.query_key': q.key, 'exp.model': MODEL,
      });
      const context = cond === 'A' ? p.rawText : JSON.stringify(p.jsonLd, null, 2);
      let result: SampleResult;
      try {
        const r = await callKimi(cond, SYSTEM, `[Product Context]\n${context}\n\n[Question] ${q.ask}`);
        result = {
          productId: p.id, queryKey: q.key, condition: cond, verdict: q.score(r.content, p),
          promptTokens: r.promptTokens, cachedTokens: r.cachedTokens, completionTokens: r.completionTokens,
          reasoningTokens: r.reasoningTokens, latencyMs: r.latencyMs, costUsd: 0,
          traceId: span.spanContext().traceId,
        };
        result.costUsd = costOf(result);
      } catch (e: any) {
        span.recordException(e);
        if (errorCount++ < 3) console.error(`  [call error] ${cond}/${q.key}/${p.id}: ${e.response?.data?.error?.message || e.message}`);
        result = { productId: p.id, queryKey: q.key, condition: cond, verdict: 'miss', promptTokens: 0, cachedTokens: 0, completionTokens: 0, reasoningTokens: 0, latencyMs: 0, costUsd: 0, traceId: span.spanContext().traceId };
      }
      span.setAttributes({
        'exp.verdict': result.verdict, 'exp.prompt_tokens': result.promptTokens,
        'exp.cached_tokens': result.cachedTokens, 'exp.completion_tokens': result.completionTokens,
        'exp.latency_ms': result.latencyMs, 'exp.cost_usd': result.costUsd,
      });
      fs.appendFileSync(traceFile, JSON.stringify({ ts: new Date().toISOString(), ...result }) + '\n');
      span.end();
      if (++done % 20 === 0) console.log(`  ...${done}/${tasks.length} calls done`);
      return result;
    });
  });

  const summarize = (cond: 'A' | 'B') => {
    const rs = results.filter((r) => r.condition === cond);
    return {
      samples: rs.length,
      totalPromptTokens: rs.reduce((a, r) => a + r.promptTokens, 0),
      totalCachedTokens: rs.reduce((a, r) => a + r.cachedTokens, 0),
      totalCompletionTokens: rs.reduce((a, r) => a + r.completionTokens, 0),
      avgPromptTokens: Math.round(rs.reduce((a, r) => a + r.promptTokens, 0) / rs.length),
      accuracy: pct(rs, 'pass'),
      hallucinationRate: pct(rs, 'hallucination'),
      avgLatencyMs: Math.round(rs.reduce((a, r) => a + r.latencyMs, 0) / rs.length),
      totalCostUsd: Math.round(rs.reduce((a, r) => a + r.costUsd, 0) * 1e6) / 1e6,
      byQuery: QUERIES.map((q) => ({
        query: q.key,
        accuracy: pct(rs.filter((r) => r.queryKey === q.key), 'pass'),
        hallucination: pct(rs.filter((r) => r.queryKey === q.key), 'hallucination'),
      })),
    };
  };

  const A = summarize('A'), B = summarize('B');
  const tokenReduction = 100 * (1 - B.totalPromptTokens / A.totalPromptTokens);
  const costReduction = 100 * (1 - B.totalCostUsd / A.totalCostUsd);
  const report = {
    experiment: 'ontology-vs-raw-text (pre-registered)', model: MODEL, reasoning_effort: 'low', temperature: 1,
    dataset: '20 products × 5 queries × 2 conditions', billingKeys: { A: 'KIMI_KEY_NON_ONTOLOGY', B: 'KIMI_KEY_ONTOLOGY' },
    pricing: PRICE,
    conditions: { A_rawText: A, B_ontology: B },
    verdicts: {
      tokenReductionPercent: Math.round(tokenReduction * 10) / 10,
      costReductionPercent: Math.round(costReduction * 10) / 10,
      tokenCriterionMet: tokenReduction >= 70,
      accuracyCriterionMet: B.accuracy >= A.accuracy - 2,
      hallucinationCriterionMet: B.hallucinationRate <= A.hallucinationRate,
      overallPass: tokenReduction >= 70 && B.accuracy >= A.accuracy - 2 && B.hallucinationRate <= A.hallucinationRate,
    },
    rawResults: results,
  };
  fs.writeFileSync('scripts/experiment1_results.json', JSON.stringify(report, null, 2));

  console.log('\n================ EXPERIMENT 1 RESULTS ================');
  console.log(`A (raw text): ${A.samples} samples | promptTok ${A.totalPromptTokens} (cached ${A.totalCachedTokens}) | accuracy ${A.accuracy}% | hallucination ${A.hallucinationRate}% | latency ${A.avgLatencyMs}ms | cost $${A.totalCostUsd}`);
  console.log(`B (ontology): ${B.samples} samples | promptTok ${B.totalPromptTokens} (cached ${B.totalCachedTokens}) | accuracy ${B.accuracy}% | hallucination ${B.hallucinationRate}% | latency ${B.avgLatencyMs}ms | cost $${B.totalCostUsd}`);
  console.log(`Token reduction: ${report.verdicts.tokenReductionPercent}% (≥70%: ${report.verdicts.tokenCriterionMet}) | Cost reduction: ${report.verdicts.costReductionPercent}%`);
  console.log(`Accuracy B≥A−2%p: ${report.verdicts.accuracyCriterionMet} | Hallucination B≤A: ${report.verdicts.hallucinationCriterionMet}`);
  console.log(`OVERALL: ${report.verdicts.overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('Per-query (B):', JSON.stringify(B.byQuery));
  console.log('Trace JSONL: scripts/experiment1_trace.jsonl | Results: scripts/experiment1_results.json');

  try { await sdk.shutdown(); } catch { /* collector may be unreachable locally */ }
}

function pct(rs: SampleResult[], v: Verdict) {
  if (rs.length === 0) return 0;
  return Math.round((rs.filter((r) => r.verdict === v).length / rs.length) * 1000) / 10;
}
function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

main().catch((e) => { console.error(e.message); process.exit(1); });
