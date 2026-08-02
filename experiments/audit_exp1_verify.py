"""
AUDIT: response-capture verification for Experiment 1.

Regenerates the SAME deterministic dataset (seed 20260802) via exp1_ontology's
generator, re-runs a small subset (3 products x 5 queries x 2 conditions)
with FULL prompt+response capture, then re-scores with exp1's own rules so
every verdict can be eyeballed against the actual model answer.

Run: .venv/bin/python experiments/audit_exp1_verify.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from exp1_ontology import (  # noqa: E402
    make_dataset, QUERIES, SYSTEM, KEYS, MODEL, call_kimi, cost_of,
)
from openai import AsyncOpenAI  # noqa: E402

API_URL = 'https://api.moonshot.ai/v1'
OUT = 'experiments/audit_exp1_verify.jsonl'
N_PRODUCTS = 3


async def main():
    clients = {c: AsyncOpenAI(base_url=API_URL, api_key=k) for c, k in KEYS.items()}
    dataset = make_dataset(20)[:N_PRODUCTS]  # same seed → first 3 of the official 20
    with open(OUT, 'w') as f:
        for p in dataset:
            for q in QUERIES:
                for cond in ('A', 'B'):
                    context = p.rawText if cond == 'A' else json.dumps(p.jsonLd, ensure_ascii=False, indent=2)
                    user = f"[Product Context]\n{context}\n\n[Question] {q['ask']}"
                    r = await call_kimi(clients[cond], SYSTEM, user)
                    rec = {
                        'productId': p.id, 'queryKey': q['key'], 'condition': cond,
                        'golden': {'moq': p.moq, 'weightGrm': p.weightGrm, 'factory': p.factory,
                                   'priceUsd': p.priceUsd, 'benchmarkKrw': p.benchmarkKrw},
                        'prompt_chars': len(user),
                        'response': r['content'],
                        'verdict': q['score'](r['content'], p),
                        'prompt_tokens': r['prompt_tokens'], 'cached_tokens': r['cached_tokens'],
                        'completion_tokens': r['completion_tokens'], 'latency_ms': r['latency_ms'],
                        'cost_usd': cost_of(r),
                    }
                    f.write(json.dumps(rec, ensure_ascii=False) + '\n')
                    print(f"{cond}/{p.id[-4:]}/{q['key']:10} verdict={rec['verdict']:13} tok={r['prompt_tokens']:5} ans={r['content'][:60]!r}")
    print(f"\nwrote {OUT}")


asyncio.run(main())
