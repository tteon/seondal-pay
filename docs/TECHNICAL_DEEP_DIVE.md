# 🔬 SEONDAL Pay — 기술 상세 문서 (Technical Deep Dive)

> 대상 독자: 심사위원/엔지니어. 각 절은 "무엇을, 왜, 어떻게(코드 위치), 검증" 순서로 기술한다.

---

## 1. A2A — 에이전트 간 통신은 어떻게 이루어지는가

### 1.1 설계 원칙: 타입드 노드만 오간다 (AGENT.md Rule 2.1)

이 시스템의 A2A는 **자유 텍스트를 주고받는 채팅이 아니다**. 크롤링 원문(노이즈 99%)을 에이전트끼리 그대로 넘기면 오류가 연쇄 증폭(cascade error)되므로, 모든 A2A 페이로드는 **schema.org/Product 정합 JSON-LD 타입드 노드**로 강제된다.

```
원문 HTML → [타이핑] → JSON-LD 노드 → A2A 전달 → 다음 에이전트는 노드만 읽는다
```

- 타이핑: `src/scraper.ts buildProductJsonLd()` — brand, offers.moq, priceSpecification, additionalProperty(Shipping Weight/Material/Factory Location/…)를 스키마에 맞춰 생성
- 스키마의 형식적 정의: `ontology/seondal-product.ofn` (ODK 관리 OWL — M1 schema.org 정합 core + M2 중국 소싱 확장: SupplierTrustProfile(诚信通), MoqPriceTier, RcepTariffPreference, TacitQualityMetrics, TrendSignal, 一件代发)
- 이 규칙이 실험으로 검증됨(§3): 원문 전달 vs 노드 전달 — 토큰 −81.4%, 환각 9%→0%

### 1.2 Agent A ↔ Agent B 메시지 시퀀스 (실제 와이어)

두 에이전트는 **MPP(Machine Payments Protocol, `draft-solana-charge-00`)의 Solana charge intent**로 통신한다. 실제 오가는 메시지:

**① A → B: 리소스 요청 (무결제)**
```http
POST /api/scrape HTTP/1.1
Content-Type: application/json

{"url": "https://www.aliexpress.com/item/1005006240212345.html", "requestedTier": 3}
```

**② B → A: HTTP 402 챌린지 (표준 헤더 + 본문)**
```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment id="3tvmfLaFZAMj...", realm="seocho-pay",
  method="solana", intent="charge",
  request="eyJhbW91bnQiOiI1MDAwMDAwMCIsImN1cnJlbmN5Ijoic29sIiwicmVjaXBpZW50IjoiNFlEbVFLTXpOUUZzWGlSY2NURlVaZU5xOVM0V2JmZDI5OFkxeG5xRmtpeGIiLCJleHRlcm5hbElkIjoiU0VPQ0hPLTE3ODU2NTY4MzMwOTItZjZhNDNmYTliNGI5IiwiZGVzY3JpcHRpb24iOiJUaWVyIDMgZGF0YSBwcm92aXNpb24iLCJtZXRob2REZXRhaWxzIjp7Im5ldHdvcmsiOiJkZXZuZXQifX0",
  expires="2026-08-02T07:52:13.092Z"
```
`request`는 **JCS(RFC 8785)로 정규화한 JSON을 base64url(무패딩)로 인코딩**한 charge request:
```json
{
  "amount": "50000000",
  "currency": "sol",
  "recipient": "4YDmQKMz...",
  "externalId": "SEOCHO-1785656833092-f6a43fa9b4b9",
  "description": "Tier 3 data provision",
  "methodDetails": {"network": "devnet"}
}
```
구현: `src/mppEngine.ts issueChallenge()` — TTL(기본 300s)과 함께 인메모리 스토어에 등록.

**③ A의 자율 판단 → 온체인 결제**
A는 정책을 스스로 평가한다 (`src/agent.ts`): 요금 ≤ 0.06 SOL이면 진행, 아니면 거절. 승인이면 트랜잭션을 만들어 **자신의 지갑으로 서명**:
```
SystemProgram.transfer(from: A_wallet, to: merchant, lamports: 50,000,000)
+ Memo instruction: "SEOCHO-1785656833092-f6a43fa9b4b9"   ← 챌린지 바인딩
+ (레거시 호환) reference 공개키를 읽기전용 계정으로 추가
```
→ Solana devnet에 전송, confirmed 대기.

**④ A → B: 크리덴셜 제시**
```http
POST /api/scrape HTTP/1.1
Authorization: Payment eyJjaGFsbGVuZ2UiOnsiaWQiOiIzdHZtZkxh...","cGF5bG9hZCI6eyJ0eXBlIjoic2lnbmF0dXJlIiwic2lnbmF0dXJlIjoiMlZEUmFROVgxTFpMN2NxUWJmQ001eTJ2WWJEQ01mc1VSWmJvZnZSNUpBSzVjcVlVWmg5ampEaWlwSENtTWVIZGtpSHl6YzlVc0ZaYzQxVFpFQ1FNN0JrSCJ9fQ
Content-Type: application/json

{"url": "...", "requestedTier": 3}
```
크리덴셜(JSON을 base64url로):
```json
{
  "challenge": {"id": "3tvmfLaFZAMj...", "realm": "seocho-pay", "method": "solana",
                "intent": "charge", "request": "eyJ...", "expires": "2026-08-02T07:52:13.092Z"},
  "source": "De6su1LcyGUmekuK2AGmGDnCwZSbeSfWoK33JFnwSkyF",
  "payload": {"type": "signature", "signature": "2VDRaQ9X...BkH"}
}
```

**⑤ B의 검증 → 200 + 영수증**
```http
HTTP/1.1 200 OK
Payment-Receipt: eyJjaGFsbGVuZ2VJZCI6IjN0dm1mTGFG...","cmVmZXJlbmNlIjoiMlZEUmFROVgxTFpMN2NxUWJmQ001eTJ2WWJEQ01mc1VSWmJvZnZSNUpBSzVjcVlVWmg5ampEaWlwSENtTWVIZGtpSHl6YzlVc0ZaYzQxVFpFQ1FNN0JrSCIsInN0YXR1cyI6InN1Y2Nlc3MifQ

{ "status": "success", "purchasedTier": 3, "data": { ... } }
```

### 1.3 서버 측 검증 논리 (`verifyPayment`, src/server.ts)

1. **리플레이 차단**: 서명이 `processedSignatures`에 있으면 거부 (MPP §10.5 — check-and-consume는 원자적)
2. **챌린지 조회**: `getChallenge(id)` — 없거나 **TTL 만료**면 `invalid-challenge` + 새 챌린지 (RFC 9457 problem+json)
3. **에코 무결성**: 크리덴셜의 `challenge.request`가 발행된 `requestB64`와 정확히 일치해야 함 (변조 차단)
4. **온체인 검증**: devnet에서 tx를 가져와 ① 잔액 변화(postBalances−preBalances ≥ 기대 lamports) ② 수신자 존재 ③ **Memo에 externalId** 존재(또는 레거시 reference 키) — 셋 다 확인
5. **소비 확정**: 서명+챌린지 소비 후에만 데이터 제공 — Tier별 페이로드 필터링(T1/T2/T3) 적용

Mock 샌드박스: `/api/mock-rpc/send-transaction`이 **진짜 서명된 트랜잭션 바이트를 역직렬화**해 transfer/Memo를 파싱하고 가짜 잔액 장부를 만든다 — devnet 없이 동일 검증 경로를 탄다 (로컬넷 대체).

---

## 2. pay.sh / Solana 결제 — 작동 원리와 우리 프로세스에의 적용

### 2.1 왜 pay.sh(MPP)인가

| 기존 방식 | 문제 | pay.sh(MPP) |
|---|---|---|
| PG/카드 | 사람 전제, 최소 결제 단위 큼, D+n 정산 | 에이전트가 지갑만으로 즉시 결제, 0.001 KRW급, 온체인 즉시 확정 |
| API 구독 | 계정/키 관리, 사람이 갱신 | 계정 없음 — 402 챌린지가 그 자리의 가격표 |
| 원화 예치 | 전자금융거래법 §28 PG 등록 의무 | **Zero-Custody**: 플랫폼이 돈을 만지지 않음(P2P 온체인) |

MPP는 HTTP의 오래된 예약 코드 **402 Payment Required**를 실제 표준으로 만든 것이다: 서버가 402에 `WWW-Authenticate: Payment`로 청구하고, 클라이언트가 `Authorization: Payment`로 증명하는 순환.

### 2.2 우리 프로세스에의 적용 포인트

1. **챌린지 = 데이터 가격표**: Tier 1/2/3(0.005/0.015/0.050 SOL)을 챌린지로 발행 — 가격이 프로토콜 안에 있어 계정·계약이 불필요
2. **externalId = 주문서 번호**: 챌린지마다 `SEOCHO-{ts}-{rand}`를 발급하고, 결제 tx의 **Memo instruction**에 그대로 박아 결제↔주문을 암호학적으로 1:1 바인딩 (정산·감사의 근거)
3. **TTL + 리플레이 차단**: 챌린지는 300초 후 자동 무효, 서명 재사용은 전역 거부 — 에이전트 세계의 "이중지불" 방지
4. **영수증 = 정산 완료 증명**: `Payment-Receipt`의 `reference` 필드가 온체인 tx 시그니처 — 누구나 solscan에서 검증 가능 (실제: `2VDRaQ9X…BkH`)
5. **레거시 병행**: 기존 x402 스타일 커스텀 헤더(`X-Payment-*`)도 동일 챌린지 스토어로 수용 — 마이그레이션 무중단

### 2.3 검증 (테스트 7종, `scripts/test_mpp_flow.ts`)

정상 결제+영수증 · 소비 서명 재사용 거부(verification-failed) · 챌린지 에코 변조 거부(invalid-challenge) · TTL 만료 거부 · 레거시 헤더 호환 · devnet 경로 Memo 디코딩 · 자율 에이전트 3연속 결제 — 전부 통과. 라이브 GKE에서도 실결제 완료(§4).

---

## 3. 실험 프로세스 (사전 등록 → 실행 → 감사)

### 3.1 방법론

두 실험 모두 **사전 등록(pre-registered)**: 실행 전에 가설·데이터셋·지표·성공 기준을 고정하고 사용자 컨펌을 받은 뒤 실행했다. 조걳별 **별도 API 키**로 Kimi 청구 계량을 분리했고, 전 호출을 OTel 스팬(Tempo 수집) + JSONL로 기록했다. 달러 비용은 공시가(K3: input miss $3.00/hit $0.30/output $15.00 per 1M)×**실측 usage 토큰**의 추정치임을 명시한다(빌링 API 미사용).

### 3.2 실험 1 — 온톨로지 효용성

- **가설**: A2A 간 JSON-LD 노드 전달이 원시 텍스트 대비 토큰 ≥70% 절감, 정확도 비열등, 환각 불증
- **데이터셋**: 시드 고정(`20260802`) 합성 상품 20개 × 팩트 질의 5개 × 2 조건 = 200 호출. 원문(~10KB)에는 **허수 디스트랙터**(타 상품의 MOQ·무게·가격) 혼입, 노드(~0.5KB)는 골든만
- **채점**: 결정적 룰(LLM 심사 아님) — 수치 ±5%, 도시명 매칭, 근거 수치 ≥2개 인용
- **통제**: 동일 모델(kimi-k3, reasoning_effort=low, temp=1 고정)·동일 프롬프트 구조, 입력 형태만 다름
- **결과**:
  | 지표 | A 원문 | B 온톨로지 | 판정 |
  |---|---|---|---|
  | 프롬프트 토큰 | 231,325 | 43,104 | **−81.4%** ✅ |
  | 팩트 정확도 | 91.0% | 98.0% | B 우월 ✅ |
  | 환각률 | 9.0% | 0.0% | ✅ |
  | 추정 비용 | $0.336 | $0.201 | −40.1% |
- **해석**: 원문의 디스트랙터가 9% 환각을 유발(감사 캡처에서 오인용 실례 확보). 온톨로지는 정확도마저 높이며 비용 절감 — Rule 2.1의 정량 입증

### 3.3 실험 2 — 멀티에이전트 유의미성

- **가설**: 역할 분해가 단일 통합 호출 대비 품질 +5%p, 토큰 3× 이내
- **프레임**: openai-agents SDK(Python) — A: 통합 에이전트 / B: 역할 4개 자유 텍스트 핸드오프 / C: 역할 4개 **STRICT JSON 타입드 핸드오프**(Rule 2.1 경계)
- **태스크**: 랜디드코스트(골든 수식) · KC 판정(골든 규정) · 인용 정확성
- **결과**:
  | 조건 | pass rate | KC 정확도 | 토큰 | 비고 |
  |---|---|---|---|---|
  | A 통합 | 90% | 90% | 3,081 | |
  | B 역할(자유 텍스트) | **50%** | 50% | 8,429 | 맥락 소실로 KC 붕괴 |
  | C 역할(타입드 JSON) | **90%** | 90% | 13,035 | 정확도 회복, 비용 4.23× |
- **합성 결론**: 멀티에이전트 오버헤드(4.23×) × 온톨로지 압축(0.19×) ≈ **0.80×** — 타입드 노드 강제 시 "원문 단일 에이전트"보다 정확도 동등 이상에 더 저렴. **역할 분해 자체가 아니라 타입드 경계가 핵심**임을 실증

### 3.4 감사 트레일 (사실성 독립 검증)

① rawResults 200건 재집계 → 리포트 수치 정확히 일치 ② trace_id 200개 유일 + 실행 시간창 연속 ③ 토큰의 상품별 변동성(상수 날조 아님) ④ 응답 전문 캡처 재실행(`experiments/audit_exp1_verify.py`) → 골든 라벨과 육안 대조, 환각 케이스의 디스트랙터 오인용 실례 확인 ⑤ TS 드라이런↔Python 공식런 동일 데이터셋 재현.

---

## 4. Google Cloud 위 무중단 운영 아키텍처

### 4.1 전체 구조

```
GitHub(tteon/seondal-pay) ──(git poll)──▶ ArgoCD(app-of-apps) ──▶ GKE Autopilot
                                                        ├─ ns seondal: seondal-pay ×2 (LB) + cloud-sql-proxy sidecar
                                                        └─ ns monitoring: Prometheus·Grafana(LB)·Loki·Tempo·OTel Collector
Cloud Run(seondal-pay v1.5.0, HTTPS) ← Artifact Registry ← docker build (로컬/CI)
Cloud SQL (PG15, app_db) ←── Auth Proxy 사이드카/Cloud Run 연결
Solana devnet ←── MPP 결제 검증
```

### 4.2 무중단을 만드는 장치들

| 장치 | 구현 | 효과 |
|---|---|---|
| **레플리카 2 + 롤링 업데이트** | `k8s/seondal-pay/deployment.yaml` replicas: 2 | 파드 1개가 죽어도 서비스 지속; 이미지 교체 시 순차 교체 |
| **헬스 프로브** | liveness/readiness `/api/health` (15s/10s 주기) | 비정상 파드 자동 재시작·트래픽 제외 |
| **ArgoCD 자기치유** | app-of-apps + automated sync(prune+selfHeal) | 수동 조작(replicas=1)도 Git 상태로 **자동 복귀** — 실연 검증됨 |
| **Cloud SQL Auth Proxy 사이드카** | 파드 내 127.0.0.1:5432 프록시 + `db.ts` 5회 재시도 | 인스턴스 재시작/부팅 경쟁에도 DB 연결 복구 (mock 폴찌는 최후 수단) |
| **GitOps 선언적 인프라** | k8s/+argocd/ 전부 Git 관리 | 재필요시 클러스터 통째 재현 가능 (`scripts/bootstrap_gke.sh` + root app) |
| **관찰성·알림** | Prometheus `/metrics` 스크레이프 + 7개 커스텀 알림 룰(다운/5xx/검증실패/리플레이/만료율/폴찌/Discord) → Alertmanager → Discord | 장애를 사람보다 알림이 먼저 감지 |
| **GKE Autopilot** | 노드 무관리, 자동 패치·자동 확장 | 노드 운영 자체가 무중단 |
| **불변 아카이브** | 원본 HTML/이미지 → GCS, 구조화 JSON-LD → Cloud SQL(JSONB+GIN) | 데이터 계층의 내구성 |

### 4.3 실제 장애 주입 검증 (2026-08-02)

1. `kubectl scale deployment/seondal-pay --replicas=1` → ArgoCD가 drift 감지, **수십 초 내 replicas=2 복귀 + Synced** (수동 조작 자동 무효화)
2. ArgoCD 자체 부분 설치 실패(RBAC) → 네임스페이스 재생성 후 선언적 매니페스트만으로 완전 복구 — 상태가 Git에만 있기에 가능
3. Grafana 크래시룹(datasource 중복, Autopilot kube-system 규제) → 매니페스트 수정 push만으로 자동 회복

### 4.4 요청이 흐르는 길 (결제 1건의 관점)

```
Agent A → Cloud Run/GKE LB → seondal-pay pod
  → mppEngine 챌린지 (in-memory, TTL) → Agent A
  → Solana devnet (A가 직접 전송·확정)
  → pod이 devnet 조회·검증 → Payment-Receipt
  → scraper → GCS(원본) + Cloud SQL(JSON-LD, Auth Proxy 사이드카 경유)
  → comparator(쿠팡 실측/관측) → Discord 알림(고ROI 시)
  → 모든 단계 /metrics + trace_id 로그 + OTel 스팬 → Prometheus/Loki/Tempo
```

---

## 5. 코드 맵 (리뷰 가이드)

| 파일 | 역할 |
|---|---|
| `src/mppEngine.ts` | MPP 엔진 (JCS, 챌린지 TTL, 크리덴셜, 영수증, Memo 추출) |
| `src/server.ts` | Agent B — 402 발행, 검증, Tier 필터링, 전 API |
| `src/agent.ts` | Agent A — 자율 정책 판단·서명·제출 |
| `src/comparatorEngine.ts` | 랜디드코스트 vs 쿠팡 실측(수수료 후 순마진) — 가격 체인: 관측→Partners→Seller→벤치마크→mock |
| `src/marketPieEngine.ts` | 마켓 파이(TOP5 점유율)·진입 마진 희생·포트폴리오 인리치 |
| `src/observability.ts` | OTel/Prometheus/구조화 로그 |
| `experiments/*.py` | 실험 1·2 (openai-agents SDK) + 감사 |
| `ontology/seondal-product.ofn` | ODK 온톨로지 (M1+M2) |
| `k8s/`, `argocd/` | GitOps 매니페스트 전체 |
