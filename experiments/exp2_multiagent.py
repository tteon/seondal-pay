"""
Experiment 2 (official, pre-registered): multi-agent significance.

Hypothesis: role-decomposed multi-agent orchestration (OpenAI Agents SDK)
beats a single unified agent on sourcing decision quality by >=5%p
(composite of pass-rate + KC accuracy), at <=3x prompt-token cost.

Conditions (same model kimi-k3, reasoning_effort=low, temperature=1):
  A: ONE unified agent (classify+cost+compliance+recommend at once)
     -> billed to KIMI_KEY_NON_ONTOLOGY
  B: FOUR role agents orchestrated via openai-agents SDK
     (classifier -> cost_calculator -> compliance -> recommender)
     -> billed to KIMI_KEY_ONTOLOGY

Tasks: landed-cost (golden formula), KC verdict (golden rules),
recommendation citation accuracy (golden values).
Run: .venv/bin/python experiments/exp2_multiagent.py
"""
import asyncio
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from dotenv import load_dotenv
from openai import AsyncOpenAI
from agents import Agent, Runner, OpenAIChatCompletionsModel, set_tracing_disabled
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

load_dotenv('.env')
set_tracing_disabled(True)

API_URL = 'https://api.moonshot.ai/v1'
MODEL = 'kimi-k3'
PRICE = {'input_miss': 3.0, 'input_hit': 0.30, 'output': 15.0}
KEYS = {
    'A': os.environ.get('KIMI_KEY_NON_ONTOLOGY', ''),
    'B': os.environ.get('KIMI_KEY_ONTOLOGY', ''),
    'C': os.environ.get('KIMI_KEY_ONTOLOGY', ''),  # typed-handoff arm bills to the ontology key
}

resource = Resource.create({'service.name': 'seondal-experiments'})
provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318') + '/v1/traces'
)))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer('seondal-experiments')

TRACE_FILE = 'experiments/exp2_trace.jsonl'
RESULTS_FILE = 'experiments/exp2_results.json'

# --- dataset: 10 products, golden landed cost + golden KC verdict ---
DATASET = [
    {'id': 'P01', 'title': '신생아 순면 롬퍼 (36개월 이하)', 'priceUsd': 12.5, 'weightGrm': 320, 'category': 'apparel', 'ageGroup': 'infant', 'kcGolden': True, 'kcRule': '어린이제품 특별안전법: 36개월 이하 유아용 섬유제품 KC 필요'},
    {'id': 'P02', 'title': '유아 실리콘 식기 세트 (식품접촉)', 'priceUsd': 8.9, 'weightGrm': 450, 'category': 'kitchenware', 'ageGroup': 'infant', 'kcGolden': True, 'kcRule': '식품위생법: 식품접촉 기구 수입신고 필요'},
    {'id': 'P03', 'title': '성인용 여름 티셔츠', 'priceUsd': 6.0, 'weightGrm': 200, 'category': 'apparel', 'ageGroup': 'adult', 'kcGolden': False, 'kcRule': '일반 성인 의류: 목록통관, KC 불필요'},
    {'id': 'P04', 'title': '아동용 LED 칫솔 (배터리 내장)', 'priceUsd': 4.2, 'weightGrm': 120, 'category': 'electronics', 'ageGroup': 'child', 'kcGolden': True, 'kcRule': '전기용품안전관리법: 배터리 내장 전기용품 안전확인 필요'},
    {'id': 'P05', 'title': '유아용 원목 치발기', 'priceUsd': 3.8, 'weightGrm': 90, 'category': 'toys', 'ageGroup': 'infant', 'kcGolden': True, 'kcRule': '어린이제품 특별안전법: 유아용 완구 안전확인 필요'},
    {'id': 'P06', 'title': '일반 면 손수건 10장 (성인용)', 'priceUsd': 5.5, 'weightGrm': 180, 'category': 'apparel', 'ageGroup': 'adult', 'kcGolden': False, 'kcRule': '유아용 아닌 일반 섬유: KC 불필요'},
    {'id': 'P07', 'title': '아동 여름 운動화 (13세용)', 'priceUsd': 15.0, 'weightGrm': 480, 'category': 'shoes', 'ageGroup': 'child', 'kcGolden': False, 'kcRule': '36개월 초과 아동 신발: KC 강제 대상 아님'},
    {'id': 'P08', 'title': '유아 침대 모빌 (완구류)', 'priceUsd': 18.0, 'weightGrm': 700, 'category': 'toys', 'ageGroup': 'infant', 'kcGolden': True, 'kcRule': '어린이제품 특별안전법: 유아용 완구 안전확인 필요'},
    {'id': 'P09', 'title': '성인용 요가매트', 'priceUsd': 11.0, 'weightGrm': 900, 'category': 'sports', 'ageGroup': 'adult', 'kcGolden': False, 'kcRule': '일반 운動용품: KC 불필요'},
    {'id': 'P10', 'title': '아기 모시 손수건 (36개월 이하)', 'priceUsd': 7.0, 'weightGrm': 150, 'category': 'apparel', 'ageGroup': 'infant', 'kcGolden': True, 'kcRule': '어린이제품 특별안전법: 36개월 이하 유아용 섬유제품 KC 필요'},
]

FORMULA = '랜디드코스트(KRW) = 도매가(USD)×1400 + 국제물류(max(2000, 무게g×7)) + 관세(의류/신발 8%, 완구/전자 0%, 기타 5%)'


def tariff_rate(category: str) -> float:
    if category in ('apparel', 'shoes'):
        return 0.08
    if category in ('toys', 'electronics'):
        return 0.0
    return 0.05


def golden_landed_cost(p: dict) -> int:
    return round(p['priceUsd'] * 1400 + max(2000, p['weightGrm'] * 7)
                 + round(p['priceUsd'] * 1400 * tariff_rate(p['category'])))


def extract_numbers(ans: str) -> list:
    return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', ans.replace(',', ''))]


def contains_number(ans: str, target: float, tol: float) -> bool:
    return any(abs(n - target) <= max(1, target * tol) for n in extract_numbers(ans))


def extract_json(text: str):
    m = re.search(r'\{[\s\S]*\}', text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def parse_kc(text: str) -> bool | None:
    if re.search(r'"kcRequired"\s*:\s*true', text):
        return True
    if re.search(r'"kcRequired"\s*:\s*false', text):
        return False
    t = re.sub(r'\s', '', text)
    if re.search(r'불필요|대상아님|면제', t) or re.search(r'^X$', t, re.M):
        return False
    if re.search(r'KC.*(필요|대상)|안전확인.*필요|수입신고.*필요', t) or re.search(r'^O$', t, re.M):
        return True
    return None


def cost_of(r: dict) -> float:
    miss = max(0, r['prompt_tokens'] - r['cached_tokens'])
    return (miss * PRICE['input_miss'] + r['cached_tokens'] * PRICE['input_hit']
            + r['completion_tokens'] * PRICE['output']) / 1e6


def usage_of(run_result) -> dict:
    u = {'prompt_tokens': 0, 'cached_tokens': 0, 'completion_tokens': 0, 'reasoning_tokens': 0}
    for resp in run_result.raw_responses:
        if resp.usage:
            u['prompt_tokens'] += resp.usage.input_tokens or 0
            u['cached_tokens'] += (resp.usage.input_tokens_details.cached_tokens
                                   if resp.usage.input_tokens_details else 0) or 0
            u['completion_tokens'] += resp.usage.output_tokens or 0
            u['reasoning_tokens'] += (resp.usage.output_tokens_details.reasoning_tokens
                                      if resp.usage.output_tokens_details else 0) or 0
    return u


def make_model(cond: str) -> OpenAIChatCompletionsModel:
    client = AsyncOpenAI(base_url=API_URL, api_key=KEYS[cond])
    return OpenAIChatCompletionsModel(model=MODEL, openai_client=client)


def score_product(p: dict, cond: str, cost_krw, kc_verdict, recommendation: str,
                  usage: dict, latency_ms: int, calls: int, trace_ids: list) -> dict:
    golden = golden_landed_cost(p)
    cost_err = abs(cost_krw - golden) / golden * 100 if cost_krw else None
    kc_correct = kc_verdict is not None and kc_verdict == p['kcGolden']
    citations = sum(1 for v in [p['priceUsd'], p['weightGrm'], golden]
                    if contains_number(recommendation, v, 0.06))
    passed = cost_err is not None and cost_err <= 10 and kc_correct and citations >= 2
    return {
        'productId': p['id'], 'condition': cond,
        'costKrw': cost_krw, 'costErrorPct': round(cost_err, 2) if cost_err is not None else None,
        'kcVerdict': kc_verdict, 'kcCorrect': kc_correct,
        'citationCount': citations, 'pass': passed,
        **usage, 'latencyMs': latency_ms, 'calls': calls,
        'costUsd': round(cost_of(usage), 6), 'traceIds': trace_ids,
    }


UNIFIED_INSTRUCTIONS = ('You are a sourcing-decision agent. 정확한 수치 계산과 규제 판정만 수행하고 '
                        '지시된 JSON 형식으로만 답하세요.')
ROLE_INSTRUCTIONS = {
    'classifier': 'You are a product classification agent. Extract attributes into the requested JSON only.',
    'cost_calculator': 'You are a landed-cost calculation agent. Apply the formula precisely; answer with the number only.',
    'compliance': 'You are a KC regulatory compliance agent. Judge import certification requirements; answer O/X plus the rule name.',
    'recommender': 'You are a sourcing recommendation agent. Conclude with numeric evidence cited.',
}


async def run_unified(p: dict) -> dict:
    with tracer.start_as_current_span('exp2.unified') as span:
        span.set_attributes({'exp.id': 'multiagent', 'exp.condition': 'A', 'exp.product_id': p['id']})
        agent = Agent(name='unified', instructions=UNIFIED_INSTRUCTIONS, model=make_model('A'))
        user = (f"[상품] {p['title']} | 도매가 ${p['priceUsd']} | 무게 {p['weightGrm']}g | "
                f"카테고리 {p['category']} | 대상 연령 {p['ageGroup']}\n{FORMULA}\n"
                '다음을 JSON 하나로 답하세요: {"landedCostKrw": number, "kcRequired": boolean, "recommendation": string}\n'
                'recommendation에는 근거 수치(도매가·무게·랜디드코스트)를 반드시 포함하세요.')
        start = time.time()
        r = await Runner.run(starting_agent=agent, input=user)
        latency = int((time.time() - start) * 1000)
        j = extract_json(r.final_output) or {}
        cost = j.get('landedCostKrw') if isinstance(j.get('landedCostKrw'), (int, float)) else (extract_numbers(r.final_output) or [None])[0]
        kc = j.get('kcRequired') if isinstance(j.get('kcRequired'), bool) else parse_kc(r.final_output)
        rec = j.get('recommendation', r.final_output)
        tid = format(span.get_span_context().trace_id, '032x')
        result = score_product(p, 'A', cost, kc, rec, usage_of(r), latency, 1, [tid])
        span.set_attributes({'exp.pass': result['pass'], 'exp.kc_correct': result['kcCorrect']})
        with open(TRACE_FILE, 'a') as f:
            f.write(json.dumps({'ts': datetime.now(timezone.utc).isoformat(), **result}) + '\n')
        return result


async def run_role_decomposed(p: dict) -> dict:
    model = make_model('B')
    trace_ids, total_usage = [], {'prompt_tokens': 0, 'cached_tokens': 0, 'completion_tokens': 0, 'reasoning_tokens': 0}
    total_latency = 0

    async def call_role(role: str, user: str) -> str:
        nonlocal total_latency
        with tracer.start_as_current_span(f'exp2.role.{role}') as span:
            span.set_attributes({'exp.id': 'multiagent', 'exp.condition': 'B', 'exp.product_id': p['id'], 'exp.role': role})
            agent = Agent(name=role, instructions=ROLE_INSTRUCTIONS[role], model=model)
            start = time.time()
            r = await Runner.run(starting_agent=agent, input=user)
            total_latency += int((time.time() - start) * 1000)
            u = usage_of(r)
            for k in total_usage:
                total_usage[k] += u[k]
            trace_ids.append(format(span.get_span_context().trace_id, '032x'))
            span.set_attribute('exp.prompt_tokens', u['prompt_tokens'])
            return r.final_output

    classifier_out = await call_role('classifier',
        f"[상품] {p['title']} | 카테고리 {p['category']} | 대상 연령 {p['ageGroup']}\n"
        '속성을 JSON으로 추출하세요: {"category": string, "ageGroup": string, "isChildrenProduct": boolean, "isElectronics": boolean}')
    attrs = extract_json(classifier_out) or {}

    cost_out = await call_role('cost_calculator',
        f"{FORMULA}\n도매가 ${p['priceUsd']}, 무게 {p['weightGrm']}g, 카테고리 {p['category']}. "
        '랜디드코스트(KRW)를 숫자 하나만 답하세요.')
    cost_krw = (extract_numbers(cost_out) or [None])[0]

    kc_out = await call_role('compliance',
        f"[상품 속성] {json.dumps(attrs, ensure_ascii=False)} | 상품명: {p['title']} | 대상 연령: {p['ageGroup']}\n"
        '한국 수입 시 KC 인증(또는 이에 준하는 강제 신고/안전확인) 필요 여부를 O/X 한 글자와 근거 규정명으로 답하세요.')
    kc_verdict = parse_kc(kc_out)

    rec_out = await call_role('recommender',
        f"[분석 결과] 상품: {p['title']} | 도매가 ${p['priceUsd']} | 무게 {p['weightGrm']}g | "
        f"랜디드코스트 ₩{cost_krw} | KC 필요: {kc_verdict}\n"
        '한국 수입 추천 여부를 2문장으로 결론 내고, 근거 수치(도매가·무게·랜디드코스트)를 반드시 포함하세요.')

    result = score_product(p, 'B', cost_krw, kc_verdict, rec_out, total_usage, total_latency, 4, trace_ids)
    with open(TRACE_FILE, 'a') as f:
        f.write(json.dumps({'ts': datetime.now(timezone.utc).isoformat(), **result}) + '\n')
    return result


async def run_condition_c(p: dict) -> dict:
    """Condition C: role agents with STRICT JSON handoff between roles —
    the ontology-typed boundary protocol (AGENT.md Rule 2.1) applied to
    multi-agent orchestration."""
    model = make_model('C')
    trace_ids, total_usage = [], {'prompt_tokens': 0, 'cached_tokens': 0, 'completion_tokens': 0, 'reasoning_tokens': 0}
    total_latency = 0

    async def call_role_json(role: str, user: str) -> dict:
        nonlocal total_latency
        with tracer.start_as_current_span(f'exp2c.role.{role}') as span:
            span.set_attributes({'exp.id': 'multiagent', 'exp.condition': 'C', 'exp.product_id': p['id'], 'exp.role': role})
            agent = Agent(name=f'{role}_json', instructions=ROLE_INSTRUCTIONS[role] + ' 출력은 반드시 유효한 JSON 하나만.', model=model)
            start = time.time()
            r = await Runner.run(starting_agent=agent, input=user)
            total_latency += int((time.time() - start) * 1000)
            u = usage_of(r)
            for k in total_usage:
                total_usage[k] += u[k]
            trace_ids.append(format(span.get_span_context().trace_id, '032x'))
            return extract_json(r.final_output) or {}

    # Typed handoff: every role emits a JSON node; the next role consumes
    # the accumulated typed node (not free text).
    node = {'product': {'title': p['title'], 'priceUsd': p['priceUsd'], 'weightGrm': p['weightGrm'],
                        'category': p['category'], 'ageGroup': p['ageGroup']}}

    attrs = await call_role_json('classifier',
        f"[상품 노드] {json.dumps(node, ensure_ascii=False)}\n"
        '속성을 추출해 JSON으로: {"category": string, "ageGroup": string, "isChildrenProduct": boolean, "isElectronics": boolean}')
    node['attributes'] = attrs

    cost_j = await call_role_json('cost_calculator',
        f"{FORMULA}\n[상품 노드] {json.dumps(node, ensure_ascii=False)}\n"
        '{"landedCostKrw": number} 형식으로만 답하세요.')
    cost_krw = cost_j.get('landedCostKrw') if isinstance(cost_j.get('landedCostKrw'), (int, float)) else None
    node['landedCost'] = {'valueKrw': cost_krw, 'formula': FORMULA}

    kc_j = await call_role_json('compliance',
        f"[상품 노드] {json.dumps(node, ensure_ascii=False)}\n"
        '한국 수입 시 KC 인증(또는 강제 신고/안전확인) 필요 여부를 {"kcRequired": boolean, "rule": string} 형식으로만 답하세요.')
    kc_verdict = kc_j.get('kcRequired') if isinstance(kc_j.get('kcRequired'), bool) else None
    node['compliance'] = {'kcRequired': kc_verdict, 'rule': kc_j.get('rule')}

    rec_j = await call_role_json('recommender',
        f"[타입드 분석 노드] {json.dumps(node, ensure_ascii=False)}\n"
        '한국 수입 추천 여부를 {"recommendation": string} 형식으로 답하되, 근거 수치(도매가·무게·랜디드코스트)를 반드시 포함하세요.')
    recommendation = rec_j.get('recommendation', json.dumps(rec_j, ensure_ascii=False))

    result = score_product(p, 'C', cost_krw, kc_verdict, recommendation, total_usage, total_latency, 4, trace_ids)
    with open(TRACE_FILE, 'a') as f:
        f.write(json.dumps({'ts': datetime.now(timezone.utc).isoformat(), **result}) + '\n')
    return result


async def main():
    if not KEYS['A'] or not KEYS['B']:
        raise SystemExit('KIMI keys required in .env')
    run_only = os.environ.get('RUN_ONLY', '')  # e.g. RUN_ONLY=C
    print(f"Dataset: {len(DATASET)} products × (1 unified + 4 role agents via openai-agents SDK) | Model: {MODEL} | RUN_ONLY={run_only or 'all'}")

    open(TRACE_FILE, 'w').close() if not run_only else None
    results = []
    for p in DATASET:
        if run_only in ('', 'A'):
            try:
                results.append(await run_unified(p))
            except Exception as e:
                print(f"  A/{p['id']} failed: {str(e)[:120]}")
        if run_only in ('', 'B'):
            try:
                results.append(await run_role_decomposed(p))
            except Exception as e:
                print(f"  B/{p['id']} failed: {str(e)[:120]}")
        if run_only in ('', 'C'):
            try:
                results.append(await run_condition_c(p))
            except Exception as e:
                print(f"  C/{p['id']} failed: {str(e)[:120]}")
        print(f"  done {p['id']}")

    # Merge with previous report when running a single condition
    if run_only and os.path.exists(RESULTS_FILE):
        prev = json.load(open(RESULTS_FILE))
        prev_results = [r for r in prev.get('rawResults', []) if r['condition'] != run_only]
        results = prev_results + results

    conditions_present = sorted({r['condition'] for r in results})

    def summarize(cond):
        rs = [r for r in results if r['condition'] == cond]
        if not rs:
            return None
        with_cost = [r for r in rs if r['costErrorPct'] is not None]
        return {
            'samples': len(rs),
            'passRate': round(len([r for r in rs if r['pass']]) / len(rs) * 100, 1),
            'avgCostErrorPct': round(sum(r['costErrorPct'] for r in with_cost) / len(with_cost), 2) if with_cost else None,
            'kcAccuracy': round(len([r for r in rs if r['kcCorrect']]) / len(rs) * 100, 1),
            'avgCitations': round(sum(r['citationCount'] for r in rs) / len(rs), 2),
            'totalPromptTokens': sum(r['prompt_tokens'] for r in rs),
            'totalCachedTokens': sum(r['cached_tokens'] for r in rs),
            'totalCostUsd': round(sum(r['costUsd'] for r in rs), 6),
            'avgLatencyMs': round(sum(r['latencyMs'] for r in rs) / len(rs)),
            'callsPerProduct': 1 if cond == 'A' else 4,
        }

    summaries = {c: summarize(c) for c in conditions_present if summarize(c)}
    A = summaries.get('A')
    composite = lambda s: (s['passRate'] + s['kcAccuracy']) / 2
    verdicts = {}
    if A:
        verdicts['compositeScoreA'] = round(composite(A), 1)
        for c in conditions_present:
            if c == 'A':
                continue
            S = summaries[c]
            gain = composite(S) - composite(A)
            ratio = S['totalPromptTokens'] / A['totalPromptTokens'] if A['totalPromptTokens'] else float('inf')
            verdicts[c] = {
                'composite': round(composite(S), 1), 'qualityGainPoints': round(gain, 1),
                'tokenRatio': round(ratio, 2),
                'qualityCriterionMet': gain >= 5, 'costCriterionMet': ratio <= 3,
                'overallPass': gain >= 5 and ratio <= 3,
            }
    report = {
        'experiment': 'multiagent-role-decomposition (pre-registered, openai-agents SDK)',
        'model': MODEL, 'reasoning_effort': 'low', 'temperature': '1 (K3 fixed)',
        'dataset': f'{len(DATASET)} products',
        'billingKeys': {'A': 'KIMI_KEY_NON_ONTOLOGY', 'B': 'KIMI_KEY_ONTOLOGY', 'C': 'KIMI_KEY_ONTOLOGY'},
        'conditionDescriptions': {
            'A': 'single unified agent (free-text everything)',
            'B': '4 role agents, free-text handoff (naive multi-agent)',
            'C': '4 role agents, STRICT JSON typed handoff (ontology boundary protocol)',
        },
        'conditions': summaries, 'verdicts': verdicts, 'rawResults': results,
    }
    with open(RESULTS_FILE, 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print('\n================ EXPERIMENT 2 (OFFICIAL) ================')
    for c, S in summaries.items():
        v = verdicts.get(c, {})
        extra = f" | gain {v.get('qualityGainPoints')}%p | ratio {v.get('tokenRatio')}x | {'✅' if v.get('overallPass') else '❌' if v else ''}" if c != 'A' else ''
        print(f"{c}: passRate {S['passRate']}% | KC acc {S['kcAccuracy']}% | costErr {S['avgCostErrorPct']}% | tokens {S['totalPromptTokens']} | ${S['totalCostUsd']} | latency {S['avgLatencyMs']}ms{extra}")
    print(f'Trace JSONL: {TRACE_FILE} | Results: {RESULTS_FILE}')

    provider.shutdown()


asyncio.run(main())
