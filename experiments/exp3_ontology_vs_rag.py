"""
Experiment 3 (differentiation): Typed Ontology vs naive RAG baseline.

Question buyers ask: "why not just use a generic RAG/OpenAI SaaS?"
Hypothesis: on noisy e-commerce pages, naive RAG (chunk + lexical retrieve)
fails where typed ontology nodes succeed — recommendation rails and Q&A
chunks out-compete spec chunks for keyword overlap, so RAG hallucinates on
distractors while paying MORE tokens.

Conditions (same kimi-k3, reasoning_effort=low, temperature=1):
  R: naive RAG — raw page split into ~500-char chunks, top-3 retrieved by
     token-overlap with the query, answer from those chunks only
     -> billed to KIMI_KEY_NON_ONTOLOGY
  B: ontology typed node (same as exp1)
     -> billed to KIMI_KEY_ONTOLOGY

Dataset: identical generator as exp1 (seed 20260802) — 20 products × 5 queries.
Run: .venv/bin/python experiments/exp3_ontology_vs_rag.py
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from exp1_ontology import (  # noqa: E402
    make_dataset, QUERIES, SYSTEM, KEYS, MODEL, call_kimi, cost_of, PRICE,
)
from openai import AsyncOpenAI  # noqa: E402
from opentelemetry import trace  # noqa: E402
from opentelemetry.sdk.trace import TracerProvider  # noqa: E402
from opentelemetry.sdk.trace.export import BatchSpanProcessor  # noqa: E402
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter  # noqa: E402
from opentelemetry.sdk.resources import Resource  # noqa: E402

API_URL = 'https://api.moonshot.ai/v1'
CONCURRENCY = 5
TOP_K = 3
CHUNK_SIZE = 500
TRACE_FILE = 'experiments/exp3_trace.jsonl'
RESULTS_FILE = 'experiments/exp3_results.json'

resource = Resource.create({'service.name': 'seondal-experiments'})
provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318') + '/v1/traces'
)))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer('seondal-experiments')


def chunk_text(text: str, size: int = CHUNK_SIZE) -> list:
    """Naive fixed-size chunking (what a generic RAG tutorial does)."""
    return [text[i:i + size] for i in range(0, len(text), size)]


def retrieve(chunks: list, query: str, k: int = TOP_K) -> list:
    """Lexical retrieval: token overlap + bigram bonus (no embeddings —
    the cheapest possible RAG baseline a generic SaaS would ship)."""
    q_tokens = {t for t in query.replace('?', ' ').replace('.', ' ').split() if len(t) >= 2}
    scored = []
    for i, ch in enumerate(chunks):
        ch_tokens = ch.split()
        overlap = sum(1 for t in q_tokens if t in ch)
        bigram = sum(1 for a, b in zip(q_tokens, list(q_tokens)[1:]) if f"{a} {b}" in ch)
        scored.append((overlap + 2 * bigram, i, ch))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [ch for _, _, ch in scored[:k]]


async def run_sample(sem, clients, p, q, trace_f):
    async with sem:
        chunks = chunk_text(p.rawText)
        retrieved = retrieve(chunks, q['ask'])
        rag_context = '\n---\n'.join(retrieved)
        results = {}
        for cond, context in (('R', rag_context), ('B', json.dumps(p.jsonLd, ensure_ascii=False, indent=2))):
            with tracer.start_as_current_span(f"exp3.{'naive_rag' if cond == 'R' else 'ontology'}.{q['key']}") as span:
                span.set_attributes({
                    'exp.id': 'ontology-vs-rag', 'exp.condition': cond,
                    'exp.product_id': p.id, 'exp.query_key': q['key'],
                    'exp.chunks_total': len(chunks), 'exp.chunks_used': TOP_K if cond == 'R' else 0,
                })
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
                    print(f"  [call error] {cond}/{q['key']}: {str(e)[:100]}")
                result['cost_usd'] = cost_of(result)
                result['trace_id'] = format(span.get_span_context().trace_id, '032x')
                span.set_attributes({'exp.verdict': result['verdict'], 'exp.prompt_tokens': result['prompt_tokens']})
                trace_f.write(json.dumps({'ts': datetime.now(timezone.utc).isoformat(), **result}) + '\n')
                trace_f.flush()
                results[cond] = result
        return results


async def main():
    if not KEYS.get('A') or not KEYS.get('B'):
        raise SystemExit('KIMI_KEY_NON_ONTOLOGY / KIMI_KEY_ONTOLOGY required in .env')
    clients = {
        'R': AsyncOpenAI(base_url=API_URL, api_key=KEYS['A']),   # RAG arm -> non-ontology key
        'B': AsyncOpenAI(base_url=API_URL, api_key=KEYS['B']),
    }
    dataset = make_dataset(20)
    print(f"Dataset: 20 products × 5 queries × 2 conditions (naive RAG top-{TOP_K} of ~{CHUNK_SIZE}ch chunks vs ontology)")
    print(f"Model: {MODEL} (reasoning_effort=low, temp=1) | billing: R→NON_ONTOLOGY, B→ONTOLOGY")

    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = []
    with open(TRACE_FILE, 'w') as trace_f:
        for p in dataset:
            for q in QUERIES:
                tasks.append(run_sample(sem, clients, p, q, trace_f))
        nested = await asyncio.gather(*tasks)
    results = [r for pair in nested for r in pair.values()]

    def summarize(cond):
        rs = [r for r in results if r['condition'] == cond]
        pct = lambda v: round(len([r for r in rs if r['verdict'] == v]) / len(rs) * 1000) / 10
        return {
            'samples': len(rs),
            'totalPromptTokens': sum(r['prompt_tokens'] for r in rs),
            'avgPromptTokens': round(sum(r['prompt_tokens'] for r in rs) / len(rs)),
            'accuracy': pct('pass'),
            'hallucinationRate': pct('hallucination'),
            'avgLatencyMs': round(sum(r['latency_ms'] for r in rs) / len(rs)),
            'totalCostUsd': round(sum(r['cost_usd'] for r in rs), 6),
            'byQuery': [{'query': q['key'],
                         'accuracy': round(len([r for r in rs if r['queryKey'] == q['key'] and r['verdict'] == 'pass']) / 20 * 100, 1)}
                        for q in QUERIES],
        }

    R, B = summarize('R'), summarize('B')
    verdicts = {
        'accuracyGainPoints': round(B['accuracy'] - R['accuracy'], 1),
        'hallucinationDeltaPoints': round(R['hallucinationRate'] - B['hallucinationRate'], 1),
        'tokenRatio': round(R['totalPromptTokens'] / B['totalPromptTokens'], 2) if B['totalPromptTokens'] else None,
        'ontologyWinsAccuracy': B['accuracy'] > R['accuracy'],
        'ontologyWinsHallucination': B['hallucinationRate'] < R['hallucinationRate'],
    }
    verdicts['overallDifferentiationShown'] = verdicts['ontologyWinsAccuracy'] and verdicts['ontologyWinsHallucination']
    report = {
        'experiment': 'ontology-vs-naive-rag (differentiation)',
        'model': MODEL, 'dataset': '20 products × 5 queries × 2 conditions',
        'ragConfig': {'chunkSize': CHUNK_SIZE, 'topK': TOP_K, 'retrieval': 'lexical overlap + bigram'},
        'billingKeys': {'R': 'KIMI_KEY_NON_ONTOLOGY', 'B': 'KIMI_KEY_ONTOLOGY'},
        'conditions': {'R_naive_rag': R, 'B_ontology': B},
        'verdicts': verdicts, 'rawResults': results,
    }
    with open(RESULTS_FILE, 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print('\n================ EXPERIMENT 3: Ontology vs naive RAG ================')
    print(f"R (naive RAG): {R['samples']} samples | promptTok {R['totalPromptTokens']} (avg {R['avgPromptTokens']}) "
          f"| accuracy {R['accuracy']}% | hallucination {R['hallucinationRate']}% | cost ${R['totalCostUsd']}")
    print(f"B (ontology):  {B['samples']} samples | promptTok {B['totalPromptTokens']} (avg {B['avgPromptTokens']}) "
          f"| accuracy {B['accuracy']}% | hallucination {B['hallucinationRate']}% | cost ${B['totalCostUsd']}")
    print(f"Accuracy gain: +{verdicts['accuracyGainPoints']}%p | Hallucination delta: −{verdicts['hallucinationDeltaPoints']}%p "
          f"| Token ratio: {verdicts['tokenRatio']}x")
    print(f"DIFFERENTIATION SHOWN: {'✅' if verdicts['overallDifferentiationShown'] else '❌'}")
    print('Per-query accuracy:', json.dumps({'R': R['byQuery'], 'B': B['byQuery']}, ensure_ascii=False))
    print(f'Trace JSONL: {TRACE_FILE} | Results: {RESULTS_FILE}')

    provider.shutdown()


asyncio.run(main())
