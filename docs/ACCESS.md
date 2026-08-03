# 🔑 SEONDAL Pay — 라이브 접속 & 계정 정보

> 평가/데모 기간 한정 접속 정보. 데모 클러스터이며 평가 종료 후 비밀번호 교체/삭제 권장.

## SaaS Console (메인 데모)

| 항목 | 값 |
|---|---|
| URL | https://seondal-pay-1064390008895.us-central1.run.app |
| 평가자 계정 | `evaluator@seondal.demo` |
| 비밀번호 | `seondal2026!` |
| 역할 | EVALUATOR (콘솔 전체 엔드포인트 체험 가능) |

## Grafana (실시간 메트릭/로그/트레이스)

| 항목 | 값 |
|---|---|
| URL | http://34.171.84.231 |
| 계정 | `admin` |
| 비밀번호 | `seondal-admin` |
| 볼 것 | 대시보드 **"SEONDAL Pay — Payments & Pipeline"** (8패널) · Explore에서 Loki 로그(`{service="seondal-pay"}`) · Tempo 트레이스 (서비스 `seondal-pay`, `seondal-experiments`) |

## ArgoCD (GitOps 강건성)

| 항목 | 값 |
|---|---|
| URL | https://136.116.158.227 |
| 계정 | `admin` |
| 비밀번호 | `wqb55MaC0F0bPTw9` |
| 볼 것 | `seondal-root` app-of-apps → 6개 앱 전부 Synced/Healthy · `seondal-pay` 앱의 리소스 트리 |
| 비밀번호 재조회 | `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' \| base64 -d` |

## GKE 앱 엔드포인트 (백본 API)

| 항목 | 값 |
|---|---|
| Base URL | http://34.46.201.195 |
| Health | `GET /api/health` |
| Metrics | `GET /metrics` (Prometheus 포맷) |
| MPP 챌린지 테스트 | `curl -i -X POST $BASE/api/scrape -H 'Content-Type: application/json' -d '{"url":"https://www.aliexpress.com/item/1005006240212345.html","requestedTier":3}'` |

## 온체인 증명 (Solana devnet)

| 항목 | 값 |
|---|---|
| 실결제 tx | [`2VDRaQ9X…BkH`](https://solscan.io/tx/2VDRaQ9X1LZL7cqQbfCM5y2vYbDCMfsURZbofvR5JAK5cqYUZh9jjDiipHCmMeHdkiHyzc9UsFZc41TZECQM7BkH?cluster=devnet) |
| Merchant 지갑 | `4YDmQKMzNQFsXiRccTFUZeNq9S4Wbfd298Y1xnqFkixb` |
| Client(Agent A) 지갑 | `De6su1LcyGUmekuK2AGmGDnCwZSbeSfWoK33JFnwSkyF` |
| 잔액 조회 API | `GET /api/wallet/balance` / `?address=<base58>` |

## Discord 알림 채널

| 항목 | 값 |
|---|---|
| 채널 | `#seondal-alerts` (서버 내) |
| 내용 | 비즈니스 알림(고ROI + OpenClaw 핸드오프) · 인프라 알림(Alertmanager) |

## GCP 리소스 맵

| 리소스 | 위치 |
|---|---|
| GKE Autopilot 클러스터 | `seondal-cluster` (us-central1, project `solana-503111`) |
| Cloud SQL | `my-db-instance` (PostgreSQL 15, us-central1-a, db `app_db`) |
| Cloud Run | `seondal-pay` (us-central1, v1.5.0) |
| Artifact Registry | `us-central1-docker.pkg.dev/solana-503111/seondal/seondal-pay` |
