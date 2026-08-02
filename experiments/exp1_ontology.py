"""
Experiment 1 (official, pre-registered): Ontology vs raw text.

Hypothesis: passing JSON-LD ontology nodes between agents (instead of raw
crawled text) reduces prompt tokens >=70% while maintaining fact accuracy
(B >= A-2%p) and not increasing hallucination.

Conditions (same model kimi-k3, reasoning_effort=low, temperature=1 [K3 fixed]):
  A: raw noisy page text      -> billed to KIMI_KEY_NON_ONTOLOGY
  B: JSON-LD typed node only  -> billed to KIMI_KEY_ONTOLOGY

Dataset: 20 synthetic-but-realistic products x 5 fact queries, golden labels
+ decoy distractors, deterministic seed (20260802).

Tracing: OTel spans per call (service=seondal-experiments) + JSONL trace.
Run: .venv/bin/python experiments/exp1_ontology.py
"""
import asyncio
import json
import os
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

from dotenv import load_dotenv
from openai import AsyncOpenAI
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

load_dotenv('.env')

API_URL = 'https://api.moonshot.ai/v1'
MODEL = 'kimi-k3'
CONCURRENCY = 5
PRICE = {'input_miss': 3.0, 'input_hit': 0.30, 'output': 15.0}  # per 1M tokens

KEYS = {
    'A': os.environ.get('KIMI_KEY_NON_ONTOLOGY', ''),
    'B': os.environ.get('KIMI_KEY_ONTOLOGY', ''),
}

# --- OTel setup ---
resource = Resource.create({'service.name': 'seondal-experiments'})
provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318') + '/v1/traces'
)))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer('seondal-experiments')

TRACE_FILE = 'experiments/exp1_trace.jsonl'
RESULTS_FILE = 'experiments/exp1_results.json'


# --- deterministic RNG: mulberry32 (same as TS dry-run) ---
class Mulberry32:
    def __init__(self, seed: int):
        self.a = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = (t ^ (t >> 15)) * (1 | t) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) ^ t & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


rand = Mulberry32(20260802)
pick = lambda arr: arr[int(rand.next() * len(arr))]

FACTORIES = ['Guangzhou', 'Yiwu', 'Shenzhen', 'Hangzhou']
TITLES = [
    '신생아 여아 순면 스플라이싱 롬퍼', '유아 실리콘 식기 4종 세트', '아동 여름 메쉬 운動화',
    '유아용 나무 치발기 세트', '아기 여름 모시 손수건 10장', '유아 방수 턱받이 3종',
    '신생아 오가닉 속싸개', '아동용 LED 장난감 칫솔', '유아 미끄럼방지 양말 5켤레', '아기 모빌 침대 장식',
]
REVIEWS = [
    '배송이 12일 걸렸어요. 별 4개 드립니다.', '사이즈 90 주문했는데 딱 맞아요.',
    '재질이 부드러워서 아이가 좋아해요. 재구매 3번째.', '색상이 사진과 조금 달라요.',
    '가격 대비 만족합니다. 리뷰 포인트 500원 받았어요.',
]


@dataclass
class GoldenProduct:
    id: str
    title: str
    priceUsd: float
    moq: int
    weightGrm: int
    factory: str
    benchmarkKrw: int
    category: str
    rawText: str = ''
    jsonLd: dict = None


def build_raw_text(p: GoldenProduct, others: list) -> str:
    """Noisy page text with distractor values — sized like a realistic
    marketplace page (~10KB+ of nav/ads/recommendations/Q&A junk)."""
    d1, d2 = pick(others), pick(others)
    sections = [
        f"카테고리 홈 > 의류 > 유아동 > 롬퍼/바디수트 | 로그인 | 장바구니 (3) | 쿠폰 2장 | 오늘의 특가",
        f"[광고] 여름 세일 최대 70% — 지금 쿠폰 받기 ▶ | 관세청 개인통관고유부호 발급 안내",
        f"{p.title} — 2025 여름 신제품 | 판매자: {p.factory} Direct Industrial Co., Ltd.",
        f"상품번호 {p.id} | 찜 1,203 | 리뷰 87개 | 누적판매 4,521개",
        f"【商品规格】最小起订量(MOQ): {d1.moq} 件 — 주의: 이 값은 추천 상품 기준이 아님",
        f"Spec Table (정렬 무작위): Material=100% Premium Cotton; Shipping Weight={p.weightGrm}g; "
        f"MOQ={p.moq} units; Factory Location={p.factory}; Origin=CN; HS Code=6111.20",
        f"배송 안내: 무게 {d2.weightGrm}g 기준 항공특송 7~14일 (연관 상품 기준) | 묶음배송 가능",
        f"가격 정보: ${p.priceUsd} USD (1~{p.moq * 10 - 1}개) | 대량 구매 시 ${p.priceUsd * 0.85:.2f} | "
        f"한국 참고 소매가: ₩{p.benchmarkKrw:,}",
        f"다른 고객이 함께 본 상품: {d1.title[:12]}... ${d1.priceUsd} | {d2.title[:12]}... ${d2.priceUsd} | "
        f"추천 벤치마크 ₩{d1.benchmarkKrw:,}",
        f"【买家评价】{pick(REVIEWS)} / {pick(REVIEWS)} / {pick(REVIEWS)}",
        f"Q&A (12): \"MOQ가 정확히 몇 개인가요?\" → \"페이지 상세 참조 부탁드립니다.\" | \"관세 포함인가요?\" → \"별도입니다.\"",
        f"유사 공장 추천: {pick(FACTORIES)} Premium Kids Wear | {pick(FACTORIES)} Baby Textile Co. — 공장 위치 문의는 채팅으로",
        f"© 2025 Marketplace. 개인정보처리방침 | 청소년보호정책 | 글로벌 배송 정책 | 판매자 센터",
    ]
    # Realistic volume: recommendation rails, banner junk, nav footer (3 rounds)
    junk = []
    for r in range(3):
        for i in range(8):
            junk.append(
                f"추천 상품 #{r * 8 + i + 1}: {pick(TITLES)} ${5 + rand.next() * 40:.2f} | "
                f"평점 {3 + rand.next() * 2:.1f} | 리뷰 {int(rand.next() * 900)} | 마감세일 {int(rand.next() * 70)}%"
            )
        junk.append(f"[배너] APP 전용 {int(rand.next() * 15 + 5)}% 추가 할인 | 타임세일 종료까지 {int(rand.next() * 23)}시간")
        junk.append(f"인기 검색어: 유아복, 롬퍼, 여름신상, 아기옷, 신생아용품, 등원룩, 실낵복, 아동잠옷")
    nav_footer = [
        "회사소개 | 인재채용 | 이용약관 | 전자금융거래약관 | 개인정보처리방침 | 청소년보호정책 | 제휴광고문의",
        "고객센터 1588-0000 (평일 09:00~18:00) | 사업자등록번호 000-00-00000 | 통신판매업신고 제0000호",
    ]
    return '\n'.join(sections[:4] + junk[:12] + sections[4:8] + junk[12:] + sections[8:] + nav_footer)


def build_json_ld(p: GoldenProduct) -> dict:
    return {
        '@context': 'https://schema.org/', '@type': 'Product', '@id': f'urn:1688:product:{p.id}',
        'name': p.title, 'category': p.category,
        'brand': {'@type': 'Brand', 'name': f'{p.factory} Direct Industrial Co., Ltd.'},
        'offers': {
            '@type': 'AggregateOffer', 'priceCurrency': 'USD', 'lowPrice': p.priceUsd,
            'moq': {'@type': 'QuantitativeValue', 'value': p.moq, 'unitCode': 'EA'},
        },
        'additionalProperty': [
            {'@type': 'PropertyValue', 'name': 'Shipping Weight', 'value': p.weightGrm, 'unitCode': 'GRM'},
            {'@type': 'PropertyValue', 'name': 'Factory Location', 'value': p.factory},
            {'@type': 'PropertyValue', 'name': 'Korean Benchmark Retail Price', 'value': p.benchmarkKrw, 'unitCode': 'KRW'},
        ],
    }


def make_dataset(n: int) -> list:
    products = []
    for _ in range(n):
        price_usd = round((8 + rand.next() * 40) * 100) / 100
        products.append(GoldenProduct(
            id=f"100500{6200000000 + int(rand.next() * 9999999)}",
            title=pick(TITLES), priceUsd=price_usd,
            moq=1 + int(rand.next() * 5),
            weightGrm=150 + int(rand.next() * 500),
            factory=pick(FACTORIES),
            benchmarkKrw=round(price_usd * 1400 * (1.5 + rand.next() * 0.8)),
            category='Wholesale Apparel > Rompers',
        ))
    for p in products:
        others = [o for o in products if o.id != p.id]
        p.rawText = build_raw_text(p, others)
        p.jsonLd = build_json_ld(p)
    return products


# --- scoring helpers ---
def extract_numbers(ans: str) -> list:
    return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', ans.replace(',', ''))]


def contains_number(ans: str, target: float, tol: float) -> bool:
    return any(abs(n - target) <= max(1, target * tol) for n in extract_numbers(ans))


def numeric_verdict(ans: str, target: float, tol: float) -> str:
    nums = extract_numbers(ans)
    if not nums:
        return 'miss'
    return 'pass' if any(abs(n - target) <= max(1, target * tol) for n in nums) else 'hallucination'


QUERIES = [
    {'key': 'moq', 'ask': '이 상품의 MOQ(최소 주문 수량)는 몇 개인가요? 숫자만 답하세요.',
     'score': lambda ans, p: numeric_verdict(ans, p.moq, 0)},
    {'key': 'weight', 'ask': '이 상품의 배송 무게는 몇 g인가요? 숫자만 답하세요.',
     'score': lambda ans, p: numeric_verdict(ans, p.weightGrm, 0.05)},
    {'key': 'factory', 'ask': '이 상품의 공장 위치(도시)는 어디인가요? 도시명만 답하세요.',
     'score': lambda ans, p: 'pass' if p.factory in ans else ('hallucination' if any(f in ans for f in FACTORIES) else 'miss')},
    {'key': 'benchmark', 'ask': '이 상품의 한국 벤치마크 소매가는 얼마인가요? 숫자만 답하세요.',
     'score': lambda ans, p: numeric_verdict(ans, p.benchmarkKrw, 0.05)},
    {'key': 'recommend', 'ask': '이 상품의 한국 수입 추천 여부를 결정하고, 근거가 된 가격·수치 2가지를 함께 답하세요.',
     'score': lambda ans, p: (lambda c: 'pass' if c >= 2 else ('miss' if c == 0 else 'hallucination'))(
         sum(1 for v in [p.priceUsd, p.benchmarkKrw, p.moq, p.weightGrm] if contains_number(ans, v, 0.06)))},
]

SYSTEM = 'You are a sourcing-analysis agent. Answer ONLY from the provided product context. 근거 없는 값을 만들지 마세요.'


async def call_kimi(client: AsyncOpenAI, system: str, user: str) -> dict:
    start = time.time()
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        temperature=1,  # K3: temperature is fixed at 1
        extra_body={'reasoning_effort': 'low'},
    )
    u = resp.usage
    cached = 0
    if getattr(u, 'prompt_tokens_details', None) and getattr(u.prompt_tokens_details, 'cached_tokens', None):
        cached = u.prompt_tokens_details.cached_tokens
    return {
        'content': (resp.choices[0].message.content or '').strip(),
        'prompt_tokens': u.prompt_tokens or 0,
        'cached_tokens': cached,
        'completion_tokens': u.completion_tokens or 0,
        'reasoning_tokens': getattr(getattr(u, 'completion_tokens_details', None), 'reasoning_tokens', 0) or 0,
        'latency_ms': int((time.time() - start) * 1000),
    }


def cost_of(r: dict) -> float:
    miss = max(0, r['prompt_tokens'] - r['cached_tokens'])
    return (miss * PRICE['input_miss'] + r['cached_tokens'] * PRICE['input_hit']
            + r['completion_tokens'] * PRICE['output']) / 1e6


async def run_sample(sem, clients, p, q, cond, trace_f):
    async with sem:
        with tracer.start_as_current_span(f"exp1.{'raw_text' if cond == 'A' else 'ontology'}.{q['key']}") as span:
            span.set_attributes({
                'exp.id': 'ontology-efficacy', 'exp.condition': cond,
                'exp.product_id': p.id, 'exp.query_key': q['key'], 'exp.model': MODEL,
            })
            context = p.rawText if cond == 'A' else json.dumps(p.jsonLd, ensure_ascii=False, indent=2)
            try:
                r = await call_kimi(clients[cond], SYSTEM, f"[Product Context]\n{context}\n\n[Question] {q['ask']}")
                result = {
                    'productId': p.id, 'queryKey': q['key'], 'condition': cond,
                    'verdict': q['score'](r['content'], p),
                    **{k: r[k] for k in ['prompt_tokens', 'cached_tokens', 'completion_tokens', 'reasoning_tokens', 'latency_ms']},
                }
            except Exception as e:
                span.record_exception(e)
                result = {'productId': p.id, 'queryKey': q['key'], 'condition': cond, 'verdict': 'miss',
                          'prompt_tokens': 0, 'cached_tokens': 0, 'completion_tokens': 0,
                          'reasoning_tokens': 0, 'latency_ms': 0}
                print(f"  [call error] {cond}/{q['key']}: {str(e)[:120]}")
            result['cost_usd'] = cost_of(result)
            result['trace_id'] = format(span.get_span_context().trace_id, '032x')
            span.set_attributes({
                'exp.verdict': result['verdict'], 'exp.prompt_tokens': result['prompt_tokens'],
                'exp.cached_tokens': result['cached_tokens'], 'exp.cost_usd': result['cost_usd'],
                'exp.latency_ms': result['latency_ms'],
            })
            trace_f.write(json.dumps({'ts': datetime.now(timezone.utc).isoformat(), **result}) + '\n')
            trace_f.flush()
            return result


async def main():
    if not KEYS['A'] or not KEYS['B']:
        raise SystemExit('KIMI_KEY_NON_ONTOLOGY / KIMI_KEY_ONTOLOGY required in .env')
    clients = {c: AsyncOpenAI(base_url=API_URL, api_key=k) for c, k in KEYS.items()}
    dataset = make_dataset(20)
    raw_avg = sum(len(p.rawText) for p in dataset) / len(dataset)
    json_avg = sum(len(json.dumps(p.jsonLd, ensure_ascii=False)) for p in dataset) / len(dataset)
    print(f"Dataset: 20 products | rawText avg {raw_avg:.0f} chars | jsonLd avg {json_avg:.0f} chars")
    print(f"Model: {MODEL} (reasoning_effort=low, temp=1[K3 fixed]) | billing keys separated per condition")

    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = []
    with open(TRACE_FILE, 'w') as trace_f:
        for p in dataset:
            for q in QUERIES:
                for cond in ('A', 'B'):
                    tasks.append(run_sample(sem, clients, p, q, cond, trace_f))
        results = await asyncio.gather(*tasks)

    def summarize(cond):
        rs = [r for r in results if r['condition'] == cond]
        pct = lambda v: round(len([r for r in rs if r['verdict'] == v]) / len(rs) * 1000) / 10
        return {
            'samples': len(rs),
            'totalPromptTokens': sum(r['prompt_tokens'] for r in rs),
            'totalCachedTokens': sum(r['cached_tokens'] for r in rs),
            'avgPromptTokens': round(sum(r['prompt_tokens'] for r in rs) / len(rs)),
            'accuracy': pct('pass'),
            'hallucinationRate': pct('hallucination'),
            'avgLatencyMs': round(sum(r['latency_ms'] for r in rs) / len(rs)),
            'totalCostUsd': round(sum(r['cost_usd'] for r in rs), 6),
            'byQuery': [{'query': q['key'],
                         'accuracy': round(len([r for r in rs if r['queryKey'] == q['key'] and r['verdict'] == 'pass']) / 20 * 100, 1),
                         'hallucination': round(len([r for r in rs if r['queryKey'] == q['key'] and r['verdict'] == 'hallucination']) / 20 * 100, 1)}
                        for q in QUERIES],
        }

    A, B = summarize('A'), summarize('B')
    token_reduction = 100 * (1 - B['totalPromptTokens'] / A['totalPromptTokens'])
    cost_reduction = 100 * (1 - B['totalCostUsd'] / A['totalCostUsd'])
    verdicts = {
        'tokenReductionPercent': round(token_reduction, 1),
        'costReductionPercent': round(cost_reduction, 1),
        'tokenCriterionMet': token_reduction >= 70,
        'accuracyCriterionMet': B['accuracy'] >= A['accuracy'] - 2,
        'hallucinationCriterionMet': B['hallucinationRate'] <= A['hallucinationRate'],
    }
    verdicts['overallPass'] = (verdicts['tokenCriterionMet'] and verdicts['accuracyCriterionMet']
                               and verdicts['hallucinationCriterionMet'])
    report = {
        'experiment': 'ontology-vs-raw-text (pre-registered, official python run)',
        'model': MODEL, 'reasoning_effort': 'low', 'temperature': '1 (K3 fixed)',
        'dataset': '20 products × 5 queries × 2 conditions',
        'billingKeys': {'A': 'KIMI_KEY_NON_ONTOLOGY', 'B': 'KIMI_KEY_ONTOLOGY'},
        'pricing': PRICE,
        'conditions': {'A_rawText': A, 'B_ontology': B},
        'verdicts': verdicts,
        'rawResults': results,
    }
    with open(RESULTS_FILE, 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print('\n================ EXPERIMENT 1 (OFFICIAL) ================')
    print(f"A (raw text): {A['samples']} samples | promptTok {A['totalPromptTokens']} (cached {A['totalCachedTokens']}) "
          f"| accuracy {A['accuracy']}% | hallucination {A['hallucinationRate']}% | latency {A['avgLatencyMs']}ms | cost ${A['totalCostUsd']}")
    print(f"B (ontology): {B['samples']} samples | promptTok {B['totalPromptTokens']} (cached {B['totalCachedTokens']}) "
          f"| accuracy {B['accuracy']}% | hallucination {B['hallucinationRate']}% | latency {B['avgLatencyMs']}ms | cost ${B['totalCostUsd']}")
    print(f"Token reduction: {verdicts['tokenReductionPercent']}% (>=70%: {verdicts['tokenCriterionMet']}) "
          f"| Cost reduction: {verdicts['costReductionPercent']}%")
    print(f"Accuracy B>=A-2%p: {verdicts['accuracyCriterionMet']} | Hallucination B<=A: {verdicts['hallucinationCriterionMet']}")
    print(f"OVERALL: {'✅ PASS' if verdicts['overallPass'] else '❌ FAIL'}")
    print('Per-query (B):', json.dumps(B['byQuery'], ensure_ascii=False))
    print(f'Trace JSONL: {TRACE_FILE} | Results: {RESULTS_FILE}')

    provider.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
