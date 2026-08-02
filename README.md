<p align="center">
  <img src="src/public/assets/brand/logo-banner.png" alt="SEONDAL — Prestigious Merchant & Asset Management" width="480">
</p>

# SEONDAL // Intelligence — `seondal-pay`

> **Clear Insights, Fair Commerce by SEONDAL**
> 이커머스 정보 비대칭성 최소화를 위한 에이전틱 결제·데이터 플랫폼

Autonomous agents buy and sell verified e-commerce sourcing data over HTTP using
**Solana micropayments** — no accounts, no API keys, no custody of fiat.
The payment layer implements the **Machine Payments Protocol (MPP,
`draft-solana-charge-00`)** Solana charge intent, with backward compatibility
for legacy `X-Payment-*` (x402-style) clients.

---

## Architecture

```
 ┌──────────────┐        402 + WWW-Authenticate: Payment        ┌──────────────┐
 │   Agent A    │ ◀──────────────────────────────────────────── │   Agent B    │
 │ (buyer, this │                                               │ (this server)│
 │  repo/agent) │  SOL transfer + Memo(externalId) on Solana    │              │
 │              │ ────────────────────────────────────────────▶ │  verify →    │
 │              │        Authorization: Payment <credential>    │  serve data  │
 │              │ ────────────────────────────────────────────▶ │  + receipt   │
 └──────────────┘                                               └──────┬───────┘
                                                                       │
                            ┌──────────────────────────────────────────┼─────────┐
                            ▼                                          ▼         ▼
                      Solana devnet                              GCS (raw HTML/  Cloud SQL
                      (or Mock RPC                               image assets)   (JSON-LD
                       sandbox fallback)                                         products)
```

- **`src/server.ts`** — Agent B: Express API, MPP + legacy 402 challenges,
  on-chain verification (amount, recipient, Memo/reference binding), tiered
  data filtering (Tier 1/2/3), full OTel instrumentation.
- **`src/agent.ts`** — Agent A: autonomous buyer. Parses the MPP challenge,
  checks its fee policy, pays on Solana (devnet or mock sandbox), presents the
  credential, reads the receipt.
- **`src/mppEngine.ts`** — MPP protocol engine: JCS (RFC 8785) canonical JSON,
  base64url, TTL-enforced challenge store, credential parsing, receipts.
- **`src/observability.ts`** — OTel traces (OTLP), Prometheus metrics
  (`/metrics`), structured JSON logs with `trace_id` correlation.
- **`src/scraper.ts` / `src/db.ts` / `src/gcp.ts`** — crawling pipeline with
  anti-bot fallback, JSON-LD enrichment, GCS + Cloud SQL (both with local
  filesystem mocks for offline dev).

## MPP conformance (`draft-solana-charge-00`)

| Element | Status |
|---|---|
| `WWW-Authenticate: Payment` challenge (JCS+base64url request) | ✅ |
| Charge request: `amount` (lamports), `currency: "sol"`, `recipient`, `externalId` | ✅ |
| `externalId` embedded as on-chain **Memo instruction** | ✅ (legacy reference-key binding also accepted) |
| `Authorization: Payment` credential, push mode (`payload.type="signature"`) | ✅ |
| `Payment-Receipt` header on success | ✅ |
| Challenge `expires` TTL enforced (default 300s) | ✅ |
| Replay protection (consumed signatures, atomic check-and-consume) | ✅ |
| RFC 9457 `application/problem+json` errors + fresh challenge | ✅ |
| Pull mode (`payload.type="transaction"`) | ⛔ explicit error (roadmap) |
| SPL/USDC (`transferChecked` + ATA) | roadmap |

## Quickstart

```bash
npm install
npm run build

# Terminal 1 — server (mock DB/GCS fallbacks activate automatically offline)
PORT=3000 npx ts-node src/server.ts

# Terminal 2 — autonomous agent (devnet; falls back to Mock Sandbox if unfunded)
SERVER_URL=http://localhost:3000/api/scrape \
MOCK_RPC_URL=http://localhost:3000/api/mock-rpc/send-transaction \
npx ts-node src/agent.ts
```

### Tests

```bash
# MPP E2E: happy path, replay, tamper, TTL expiry, legacy compat
PORT=3000 MPP_CHALLENGE_TTL_SECONDS=6 npx ts-node src/server.ts &
npx ts-node scripts/test_mpp_flow.ts

# Devnet-path memo decoding unit check
npx ts-node scripts/test_memo_decode.ts
```

## Observability

- **Metrics** — `GET /metrics` (Prometheus): payment challenges/verifications/
  replays/expiry/revenue, scrape duration, DB ops, GCS uploads, HTTP latency.
- **Logs** — JSON lines with `trace_id`/`span_id` (Loki ↔ Tempo correlation).
- **Traces** — OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`).
- **Health** — `GET /api/health` (Kubernetes probes).

Full stack (Prometheus + Grafana + Loki + Tempo + OTel Collector) deploys via
ArgoCD from [`k8s/`](k8s/) — see [GitOps deployment](#gitops-gke--argocd).

## GitOps (GKE + ArgoCD)

```bash
# 1. One-time cluster + secrets bootstrap (see scripts/bootstrap_gke.sh)
# 2. ArgoCD app-of-apps
kubectl apply -f argocd/root-application.yaml
```

ArgoCD then continuously deploys:
- `seondal-pay` (this app) → namespace `seondal`
- `kube-prometheus-stack` (Prometheus + Grafana) → `monitoring`
- `loki`, `tempo`, `opentelemetry-collector` → `monitoring`

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `MPP_CHALLENGE_TTL_SECONDS` | `300` | 402 challenge lifetime |
| `MPP_REALM` | `seocho-pay` | `WWW-Authenticate` realm |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTel Collector |
| `DB_HOST` / `INSTANCE_CONNECTION_NAME` | — | Cloud SQL (mock JSON fallback) |
| `GCS_BUCKET` | `solana-paysh-scraped-data` | raw asset bucket (mock fallback) |
| `KIMI_API_KEY` / `MARA_API_KEY` | — | LLM ensemble (rule-based fallback) |

Secrets are **never** committed — `gcp-key.json`, keypairs, `.env` are
gitignored and injected via Kubernetes Secrets at deploy time.

## Roadmap

- [ ] Live devnet verification CI (faucet-funded)
- [ ] MPP pull mode (`payload.type="transaction"`, server-side broadcast)
- [ ] SPL/USDC settlement (`transferChecked` + ATA derivation)
- [ ] Facilitator split (`/verify`, `/settle`) per x402 v2
- [ ] Ontology lifecycle via [ODK](https://github.com/INCATools/ontology-development-kit)
      (OWL sources + ROBOT QC in CI; runtime consumes release artifacts)
- [ ] Python AI inference pod (seocho brain) as separate ArgoCD app

## License

MIT
