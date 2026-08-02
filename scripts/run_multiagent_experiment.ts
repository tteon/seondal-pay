/**
 * run_multiagent_experiment.ts — Experiment 2 (pre-registered, Kimi K3 only)
 *
 * Hypothesis: role-decomposed multi-call (multi-agent analog) beats a single
 * unified call on sourcing decision quality by ≥5%p, at ≤3× token cost.
 *
 * Conditions (same model kimi-k3, reasoning_effort=low, temperature 0):
 *   A: single unified prompt (classify+cost+compliance+recommend at once)
 *      → billed to KIMI_KEY_NON_ONTOLOGY
 *   B: 4 role-decomposed calls + deterministic merge
 *      → billed to KIMI_KEY_ONTOLOGY
 *
 * Tasks per product: landed-cost calculation (golden formula), KC verdict
 * (golden rules), recommendation citation accuracy (golden values).
 * Run: npx ts-node scripts/run_multiagent_experiment.ts
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
const KEYS: Record<'A' | 'B', string> = {
  A: process.env.KIMI_KEY_NON_ONTOLOGY || '',
  B: process.env.KIMI_KEY_ONTOLOGY || '',
};
const PRICE = { inputMiss: 3.0, inputHit: 0.3, output: 15.0 };

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'seondal-experiments' }),
  traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
});
sdk.start();
const tracer = trace.getTracer('seondal-experiments', '1.0.0');
const traceFile = 'scripts/experiment2_trace.jsonl';
fs.writeFileSync(traceFile, '');

// --- dataset: 10 products, golden landed cost + golden KC verdict ---
interface Exp2Product {
  id: string; title: string; priceUsd: number; weightGrm: number;
  category: string; ageGroup: string; kcGolden: boolean; kcRule: string;
}
const DATASET: Exp2Product[] = [
  { id: 'P01', title: '신생아 순면 롬퍼 (36개월 이하)', priceUsd: 12.5, weightGrm: 320, category: 'apparel', ageGroup: 'infant', kcGolden: true, kcRule: '어린이제품 특별안전법: 36개월 이하 유아용 섬유제품 KC 필요' },
  { id: 'P02', title: '유아 실리콘 식기 세트 (식품접촉)', priceUsd: 8.9, weightGrm: 450, category: 'kitchenware', ageGroup: 'infant', kcGolden: true, kcRule: '식품위생법: 식품접촉 기구 수입신고 필요' },
  { id: 'P03', title: '성인용 여름 티셔츠', priceUsd: 6.0, weightGrm: 200, category: 'apparel', ageGroup: 'adult', kcGolden: false, kcRule: '일반 성인 의류: 목록통관, KC 불필요' },
  { id: 'P04', title: '아동용 LED 칫솔 (배터리 내장)', priceUsd: 4.2, weightGrm: 120, category: 'electronics', ageGroup: 'child', kcGolden: true, kcRule: '전기용품안전관리법: 배터리 내장 전기용품 안전확인 필요' },
  { id: 'P05', title: '유아용 원목 치발기', priceUsd: 3.8, weightGrm: 90, category: 'toys', ageGroup: 'infant', kcGolden: true, kcRule: '어린이제품 특별안전법: 유아용 완구 안전확인 필요' },
  { id: 'P06', title: '일반 면 손수건 10장 (성인용)', priceUsd: 5.5, weightGrm: 180, category: 'apparel', ageGroup: 'adult', kcGolden: false, kcRule: '유아용 아닌 일반 섬유: KC 불필요' },
  { id: 'P07', title: '아동 여름 운動화 (13세용)', priceUsd: 15.0, weightGrm: 480, category: 'shoes', ageGroup: 'child', kcGolden: false, kcRule: '36개월 초과 아동 신발: KC 강제 대상 아님' },
  { id: 'P08', title: '유아 침대 모빌 (완구류)', priceUsd: 18.0, weightGrm: 700, category: 'toys', ageGroup: 'infant', kcGolden: true, kcRule: '어린이제품 특별안전법: 유아용 완구 안전확인 필요' },
  { id: 'P09', title: '성인용 요가매트', priceUsd: 11.0, weightGrm: 900, category: 'sports', ageGroup: 'adult', kcGolden: false, kcRule: '일반 운動용품: KC 불필요' },
  { id: 'P10', title: '아기 모시 손수건 (36개월 이하)', priceUsd: 7.0, weightGrm: 150, category: 'apparel', ageGroup: 'infant', kcGolden: true, kcRule: '어린이제품 특별안전법: 36개월 이하 유아용 섬유제품 KC 필요' },
];

function tariffRate(category: string): number {
  if (category === 'apparel' || category === 'shoes') return 0.08;
  if (category === 'toys' || category === 'electronics') return 0;
  return 0.05;
}
function goldenLandedCost(p: Exp2Product): number {
  return Math.round(p.priceUsd * 1400 + Math.max(2000, p.weightGrm * 7) + Math.round(p.priceUsd * 1400 * tariffRate(p.category)));
}

const FORMULA_TEXT = '랜디드코스트(KRW) = 도매가(USD)×1400 + 국제물류(max(2000, 무게g×7)) + 관세(의류/신발 8%, 완구/전자 0%, 기타 5%)';

interface LlmResult {
  content: string; promptTokens: number; cachedTokens: number;
  completionTokens: number; reasoningTokens: number; latencyMs: number;
}
async function callKimi(cond: 'A' | 'B', system: string, user: string): Promise<LlmResult> {
  const start = Date.now();
  const res = await axios.post(
    KIMI_API_URL,
    { model: MODEL, reasoning_effort: 'low', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 1 },
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

interface ProductResult {
  productId: string; condition: 'A' | 'B';
  costKrw: number | null; costErrorPct: number | null;
  kcVerdict: boolean | null; kcCorrect: boolean;
  citationCount: number; pass: boolean;
  promptTokens: number; cachedTokens: number; completionTokens: number;
  latencyMs: number; calls: number; costUsd: number; traceIds: string[];
}

function costOf(r: { promptTokens: number; cachedTokens: number; completionTokens: number }): number {
  const miss = Math.max(0, r.promptTokens - r.cachedTokens);
  return (miss * PRICE.inputMiss + r.cachedTokens * PRICE.inputHit + r.completionTokens * PRICE.output) / 1e6;
}
function extractJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
function extractNumbers(ans: string): number[] {
  return (ans.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []).map(Number);
}
function containsNumber(ans: string, target: number, tol: number): boolean {
  return extractNumbers(ans).some((n) => Math.abs(n - target) <= Math.max(1, target * tol));
}
function parseKc(text: string): boolean | null {
  const t = text.replace(/\s/g, '');
  if (/KC.*(필요|대상|O)(?![가-힣]*불)/.test(t) || /"kcRequired"\s*:\s*true/.test(text) || /^O$/m.test(t)) return true;
  if (/불필요|대상아님|X/.test(t) || /"kcRequired"\s*:\s*false/.test(text)) return false;
  return null;
}

function scoreProduct(
  p: Exp2Product, cond: 'A' | 'B',
  costKrw: number | null, kcVerdict: boolean | null, recommendation: string,
  usage: { promptTokens: number; cachedTokens: number; completionTokens: number; latencyMs: number },
  calls: number, traceIds: string[]
): ProductResult {
  const golden = goldenLandedCost(p);
  const costErrorPct = costKrw ? Math.abs(costKrw - golden) / golden * 100 : null;
  const kcCorrect = kcVerdict === p.kcGolden;
  const citationCount = [p.priceUsd, p.weightGrm, golden].filter((v) => containsNumber(recommendation, v, 0.06)).length;
  const pass = costErrorPct !== null && costErrorPct <= 10 && kcCorrect && citationCount >= 2;
  return {
    productId: p.id, condition: cond,
    costKrw, costErrorPct: costErrorPct !== null ? Math.round(costErrorPct * 100) / 100 : null,
    kcVerdict, kcCorrect, citationCount, pass,
    ...usage, calls, costUsd: costOf(usage), traceIds,
  };
}

const SYSTEM_A = 'You are a sourcing-decision agent. 정확한 수치 계산과 규제 판정만 수행하고 지시된 JSON 형식으로만 답하세요.';
const SYSTEM_B = 'You are a specialized role agent in a sourcing pipeline. 맡은 역할의 출력만 정확히 반환하세요.';

async function runUnified(p: Exp2Product): Promise<ProductResult> {
  return tracer.startActiveSpan('exp2.unified', async (span) => {
    span.setAttributes({ 'exp.id': 'multiagent', 'exp.condition': 'A', 'exp.product_id': p.id, 'exp.model': MODEL });
    const user = `[상품] ${p.title} | 도매가 $${p.priceUsd} | 무게 ${p.weightGrm}g | 카테고리 ${p.category} | 대상 연령 ${p.ageGroup}
${FORMULA_TEXT}
다음을 JSON 하나로 답하세요: {"landedCostKrw": number, "kcRequired": boolean, "recommendation": string}
recommendation에는 근거 수치(도매가·무게·랜디드코스트)를 반드시 포함하세요.`;
    const r = await callKimi('A', SYSTEM_A, user);
    const j = extractJson(r.content) || {};
    const result = scoreProduct(
      p, 'A',
      typeof j.landedCostKrw === 'number' ? j.landedCostKrw : (extractNumbers(r.content)[0] ?? null),
      typeof j.kcRequired === 'boolean' ? j.kcRequired : parseKc(r.content),
      j.recommendation || r.content,
      { promptTokens: r.promptTokens, cachedTokens: r.cachedTokens, completionTokens: r.completionTokens, latencyMs: r.latencyMs },
      1, [span.spanContext().traceId]
    );
    span.setAttributes({ 'exp.pass': result.pass, 'exp.cost_error_pct': result.costErrorPct ?? -1, 'exp.kc_correct': result.kcCorrect });
    fs.appendFileSync(traceFile, JSON.stringify({ ts: new Date().toISOString(), ...result }) + '\n');
    span.end();
    return result;
  });
}

async function runRoleDecomposed(p: Exp2Product): Promise<ProductResult> {
  const traceIds: string[] = [];
  let usage = { promptTokens: 0, cachedTokens: 0, completionTokens: 0, latencyMs: 0 };

  const callRole = async (role: string, user: string): Promise<string> => {
    return tracer.startActiveSpan(`exp2.role.${role}`, async (span) => {
      span.setAttributes({ 'exp.id': 'multiagent', 'exp.condition': 'B', 'exp.product_id': p.id, 'exp.role': role, 'exp.model': MODEL });
      const r = await callKimi('B', SYSTEM_B, user);
      usage.promptTokens += r.promptTokens;
      usage.cachedTokens += r.cachedTokens;
      usage.completionTokens += r.completionTokens;
      usage.latencyMs += r.latencyMs;
      traceIds.push(span.spanContext().traceId);
      span.setAttribute('exp.prompt_tokens', r.promptTokens);
      fs.appendFileSync(traceFile, JSON.stringify({ ts: new Date().toISOString(), productId: p.id, condition: 'B', role, promptTokens: r.promptTokens, cachedTokens: r.cachedTokens, completionTokens: r.completionTokens, latencyMs: r.latencyMs, traceId: span.spanContext().traceId }) + '\n');
      span.end();
      return r.content;
    });
  };

  // Role 1: classifier
  const classifierOut = await callRole('classifier',
    `[상품] ${p.title} | 카테고리 ${p.category} | 대상 연령 ${p.ageGroup}
속성을 JSON으로 추출하세요: {"category": string, "ageGroup": string, "isChildrenProduct": boolean, "isElectronics": boolean}`);
  const attrs = extractJson(classifierOut) || {};

  // Role 2: cost calculator
  const costOut = await callRole('cost_calculator',
    `${FORMULA_TEXT}
도매가 $${p.priceUsd}, 무게 ${p.weightGrm}g, 카테고리 ${p.category}. 랜디드코스트(KRW)를 숫자 하나만 답하세요.`);
  const costKrw = extractNumbers(costOut)[0] ?? null;

  // Role 3: compliance auditor
  const kcOut = await callRole('compliance',
    `[상품 속성] ${JSON.stringify(attrs)} | 상품명: ${p.title} | 대상 연령: ${p.ageGroup}
한국 수입 시 KC 인증(또는 이에 준하는 강제 신고/안전확인) 필요 여부를 O/X 한 글자와 근거 규정명으로 답하세요.`);
  const kcVerdict = parseKc(kcOut);

  // Role 4: recommendation synthesizer
  const recOut = await callRole('recommender',
    `[분석 결과] 상품: ${p.title} | 도매가 $${p.priceUsd} | 무게 ${p.weightGrm}g | 랜디드코스트 ₩${costKrw} | KC 필요: ${kcVerdict}
한국 수입 추천 여부를 2문장으로 결론 내고, 근거 수치(도매가·무게·랜디드코스트)를 반드시 포함하세요.`);

  return scoreProduct(p, 'B', costKrw, kcVerdict, recOut, usage, 4, traceIds);
}

async function main() {
  if (!KEYS.A || !KEYS.B) { console.error('KIMI keys required in .env'); process.exit(1); }
  console.log(`Dataset: ${DATASET.length} products × (1 unified + 4 role calls) | Model: ${MODEL}`);

  const results: ProductResult[] = [];
  for (const p of DATASET) {
    try { results.push(await runUnified(p)); } catch (e: any) { console.error(`A/${p.id} failed: ${e.message}`); }
    try { results.push(await runRoleDecomposed(p)); } catch (e: any) { console.error(`B/${p.id} failed: ${e.message}`); }
    console.log(`  done ${p.id}`);
  }

  const summarize = (cond: 'A' | 'B') => {
    const rs = results.filter((r) => r.condition === cond);
    const withCost = rs.filter((r) => r.costErrorPct !== null);
    return {
      samples: rs.length,
      passRate: Math.round(rs.filter((r) => r.pass).length / rs.length * 1000) / 10,
      avgCostErrorPct: withCost.length ? Math.round(withCost.reduce((a, r) => a + (r.costErrorPct || 0), 0) / withCost.length * 100) / 100 : null,
      kcAccuracy: Math.round(rs.filter((r) => r.kcCorrect).length / rs.length * 1000) / 10,
      avgCitations: Math.round(rs.reduce((a, r) => a + r.citationCount, 0) / rs.length * 100) / 100,
      totalPromptTokens: rs.reduce((a, r) => a + r.promptTokens, 0),
      totalCostUsd: Math.round(rs.reduce((a, r) => a + r.costUsd, 0) * 1e6) / 1e6,
      avgLatencyMs: Math.round(rs.reduce((a, r) => a + r.latencyMs, 0) / rs.length),
      callsPerProduct: cond === 'A' ? 1 : 4,
    };
  };

  const A = summarize('A'), B = summarize('B');
  const composite = (s: typeof A) => (s.passRate + s.kcAccuracy) / 2;
  const qualityGain = composite(B) - composite(A);
  const tokenRatio = B.totalPromptTokens / A.totalPromptTokens;
  const report = {
    experiment: 'multiagent-role-decomposition (pre-registered)', model: MODEL, reasoning_effort: 'low', temperature: 1,
    dataset: `${DATASET.length} products`, billingKeys: { A: 'KIMI_KEY_NON_ONTOLOGY', B: 'KIMI_KEY_ONTOLOGY' },
    conditions: { A_unified: A, B_role_decomposed: B },
    verdicts: {
      compositeScoreA: composite(A), compositeScoreB: composite(B), qualityGainPoints: Math.round(qualityGain * 10) / 10,
      tokenRatio: Math.round(tokenRatio * 100) / 100,
      qualityCriterionMet: qualityGain >= 5,
      costCriterionMet: tokenRatio <= 3,
      overallPass: qualityGain >= 5 && tokenRatio <= 3,
    },
    rawResults: results,
  };
  fs.writeFileSync('scripts/experiment2_results.json', JSON.stringify(report, null, 2));

  console.log('\n================ EXPERIMENT 2 RESULTS ================');
  console.log(`A (unified):         passRate ${A.passRate}% | costErr ${A.avgCostErrorPct}% | KC acc ${A.kcAccuracy}% | cites ${A.avgCitations} | tokens ${A.totalPromptTokens} | $${A.totalCostUsd} | latency ${A.avgLatencyMs}ms`);
  console.log(`B (role-decomposed): passRate ${B.passRate}% | costErr ${B.avgCostErrorPct}% | KC acc ${B.kcAccuracy}% | cites ${B.avgCitations} | tokens ${B.totalPromptTokens} | $${B.totalCostUsd} | latency ${B.avgLatencyMs}ms`);
  console.log(`Quality gain: +${report.verdicts.qualityGainPoints}%p (≥5: ${report.verdicts.qualityCriterionMet}) | Token ratio ${report.verdicts.tokenRatio}x (≤3: ${report.verdicts.costCriterionMet})`);
  console.log(`OVERALL: ${report.verdicts.overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('Trace JSONL: scripts/experiment2_trace.jsonl | Results: scripts/experiment2_results.json');

  try { await sdk.shutdown(); } catch { /* collector may be unreachable locally */ }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
