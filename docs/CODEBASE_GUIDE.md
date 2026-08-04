# 🗺️ SEONDAL Pay — 코드베이스 정밀 가이드 (다음 담당자용)

> 이 문서 하나로 이 프로젝트를 이어서 구현할 수 있어야 합니다.
> 각 모듈: **역할 → 핵심 함수 → 데이터 흐름 → 확장 포인트 → 주의사항**.

---

## 0. 60초 요약

M2M 결제(MPP/Solana)로 소싱 데이터를 파는 서버(Agent B) + 자율 구매 에이전트(Agent A).
데이터 흐름: `크롤링 → JSON-LD 타이핑 → GCS+Cloud SQL → 컴패레이터(마진) → 프로파일 라우팅 → Discord/챗/MCP`.
진입점: `src/server.ts` (모든 HTTP 라우트, ~1519줄).

---

## 1. 결제 코어 (MPP) — 이 프로젝트의 심장

### `src/mppEngine.ts` (304줄)
MPP(`draft-solana-charge-00`) Solana charge intent 구현체. **공식 SDK 없이 손으로 만든 것이 의도된 설계** — 결제 게이트가 디스패치 한가울에 필요해서.

| 함수 | 역할 |
|---|---|
| `issueChallenge(opts)` | 402 챌린지 발급: `amount`(lamports 문자열), `currency:"sol"`, `recipient`, `externalId`(SEOCHO-ts-hex), `methodDetails.network`. JCS(RFC8785) 정규화 → base64url(무패딩) → `requestB64`. TTL(기본 300s, env `MPP_CHALLENGE_TTL_SECONDS`)과 함께 인메모리 Map 저장 |
| `getChallenge(id)` | 조회 + **만료면 삭제하고 undefined** (TTL 강제 지점) + `paymentChallengeExpired` 메트릭 |
| `consumeChallenge(id)` | 원자적 check-and-consume (Map.delete) — 리플레이 방지 |
| `buildWwwAuthenticateHeader(ch)` | `WWW-Authenticate: Payment id=… realm=… method="solana" intent="charge" request="…" expires="…"` |
| `parseWwwAuthenticate(h)` | 클라이언트 측 챌린지 파서 (key="value" 쌍) |
| `buildPaymentCredential(params, payer, signature)` | `Authorization: Payment <base64url JCS>` 생성 (push mode, payload.type="signature") |
| `parsePaymentCredential(h)` | 서버 측 크리덴셜 디코딩 (null on malformed) |
| `buildPaymentReceipt(ch, sig)` | 성공 시 `Payment-Receipt` 헤더 (challengeId, reference=tx sig, status, timestamp) |
| `extractMemosFromCompiledMessage(keys, ixs)` | devnet 응답에서 Memo instruction 내용 추출 (base58 data → utf-8) |

**상수**: `MEMO_PROGRAM_ID_V2 = MemoSq4gq…` (Memo v1도 인식).

### `src/server.ts` — 결제 경로
- `POST /api/scrape`: ① `Authorization: Payment` 헤더 있으면 **MPP 경로** (`handleMppPaidRequest`) ② 아니면 레거시 `x-payment-signature/reference` 경로 ③ 둘 다 없으면 `sendPaymentChallenge` (402 + 양쪽 헤더 병행)
- `verifyPayment(signature, recipient, amountSol, {legacyReference?, externalId?})`: mock store 우선 → devnet `getTransaction` → **바인딩(reference 키 OR externalId Memo) + 수신자 잔액 변화 ≥ 기대값** 확인
- `sendMppProblem()`: RFC 9457 `application/problem+json` + **새 챌린지 자동 재발행** (스펙 §12)
- Mock RPC `POST /api/mock-rpc/send-transaction`: 서명된 tx 바이트를 진짜 역직렬화해 transfer 금액·수신자·Memo를 파싱, 가짜 잔액 장부 생성 — **devnet 없이 동일 검증 경로** (로컬넷 대체)
- Tier 필터 `filterPayloadByTier`: T1 메타만 / T2 +offers·additionalProperty(단, 한국 벤치마크가·ROI 제외) / T3 전체

### `src/agent.ts` (331줄) — Agent A (자율 구매자)
`evaluateAndScrape()`: 402 수신 → **정책 검증**(≤0.06 SOL, 초과 시 자율 거절) → transfer + Memo(externalId) + reference 키 → devnet 전송(mock 폴찌) → **MPP 크리덴셜 + 레거시 헤더 병행** 제출 → 영수증 로깅. 챌린지 만료 시 bounded retry(2회).

### 테스트
- `scripts/test_mpp_flow.ts` — 7플로우(정상/재생/변조/만료/레거시) **배포 전 필수**
- `scripts/test_memo_decode.ts` — 컴파일된 메시지의 Memo 디코딩
- `scripts/live_payment_once.ts` — 라이브 1건 결제 (mock-RPC 경로)
- `scripts/test_mcp_flow.ts` — MCP 7체크 (도구 8개 기대)

---

## 2. 데이터 파이프라인

### `src/scraper.ts` (287줄)
`scrapeProduct(url)` → axios(브라우저 UA, 10s) → 안티봇 감지(403/sec-cpt/<2KB) 시 **합성 폴찌**(가격·이미지 랜덤 생성 — 데모용, 주의) → cheerio 파싱(title/price/image만 실제) → GCS 저장(원본 HTML+이미지) → `buildProductJsonLd()` + `miningEnrichJsonLd()` → `upsertProduct()`.
⚠️ **MOQ/무게/공장위치/벤치마크가는 합성값** — 실제 파싱은 title/price/imageUrl 뿐. 진짜 1688 파싱이 다음 과제.

### `src/db.ts` (218줄)
pg Pool (Cloud SQL) ⇄ mock JSON (`local_gcp_mock/postgresql/products.json`). `initDb()`는 **5회×3초 재시도** 후 mock 폴찌 — Cloud SQL Auth Proxy 사이드카 부팅 경쟁 때문. `products` 테이블: `data_json_ld JSONB + GIN 인덱스`. 모든 조작에 `dbOperations`/`dbOperationDuration` 메트릭.

### `src/gcp.ts`
`gcp-key.json` 존재 or K_SERVICE → 실제 Firestore/Storage, 아니면 파일시스템 mock. `isGcpConfigured()`로 판별.

---

## 3. 마진·시장 인텔리전스

### `src/comparatorEngine.ts` (307줄)
```
랜디드코스트 = 도매가(¥×190 | $×1400) + 국제운송(max(2000, g×7)) + 관세(의류8%/완구전자0%/기타5%)
순수익      = 쿠팡가 − 수수료(10.8%) − 카테고리 배송비(3~6천)
ROI         = (순수익 − 랜디드) / 랜디드
```
**쿠팡가 체인 (우선순위)**: ① 관측값(`coupangObservationStore`) ② Partners 검색 ③ Seller 자체등록 ④ 카테고리 벤치마크 ⑤ mock. `runComparatorSweep()` 전 상품 스윕 → 인메모리 margin curve (96포인트 링버퍼) + `comparatorMarginGauge`. 15분 루프 (`COMPARATOR_INTERVAL_MS`).

### `src/coupangPartnersClient.ts` / `src/coupangSellerClient.ts`
CEA HMAC-SHA256 서명 (`signedDate + METHOD + path + query`). ⚠️ **RULE: 상품 정볳만 — 정산/주문/반품 엔드포인트 절대 금지**. Seller API는 vendor `A01746811` 범위. Partners는 별도 프로그램 승인 필요 (현재 키는 Seller용).

### `src/coupangObservationStore.ts` (162줄)
OpenClaw/수동 실측 쿠팡 가격의 인메모리 스토어 (시드 내장, MAX 500). `matchObservation(title)` 토큰-오버랩 매칭. **재배포 시 인메모리 소실 주의** — `scripts/demo_market_pie_10cats.ts`로 재시딩.

### `src/marketPieEngine.ts` (268줄)
- `computeMarketPie(group)`: TOP5 월판매 점유율 + 가격 min/median/max. **동의어 그루핑**(`GROUP_SYNONYMS`: 식기↔식판 등 — 온톨로지 sameAsSynonym 적용점)
- `computeEntryAnalysis(group, landedCost, targetRoi)`: 진입가 후보(언더컷−3%/중앙값/프리미엄/목표ROI가) + **최소 마진 희생** 계산 + 한국어 가이드 문장
- `enrichPortfolioWithMarketEntry(portfolio)`: 포트폴리오 각 라인에 verdict(enter/shrink/avoid/no-data) 부착

### `src/interestProfileEngine.ts` (144줄)
프로파일 = 금융 카테고리(ROI 밴드·최소마진·리스크 허용도). `routeOpportunity()` — 하드 필터(밴드 밖·마진 미달·리스크 초과 탈락) 후 스코어(ROI50+마진30+카테고리20).

---

## 4. 사용자 레이어

### `src/liveSourcingPipeline.ts` (290줄) — 챗 데모 백엔드
**모든 스텝 문구는 초보 평문** (전문용어 금지 — 사용자 명시 규칙). 창고 매칭 실패 시 → **마켓 파이 fallback** (진입 분석, 추정 원가=중앙값×40% 가정 명시). `/api/demo/live-sourcing`.

### `src/mcpServer.ts` (278줄) — MCP 서버 (자체 구현, 공식 SDK 미사용)
`POST /mcp` JSON-RPC 2.0. 물룡 7종 + **유료 `get_sourcing_analysis`(MPP 게이트)**. `get_payment_challenge`가 MPP 챌린지를 발행하고, paid 도구는 `paymentSignature`를 verifyPayment로 검증 (리플레이/TTL 동일 적용). 클라이언트 가이드: `docs/MCP_CLIENT_GUIDE.md`.

### `src/onboardingEngine.ts` / `src/portfolioEngine.ts` / `src/pricingEngine.ts` / `src/categoryCatalog.ts` / `src/alertRuleEngine.ts` / `src/complianceVerdictEngine.ts`
- 온보닝: 레벨(beginner/growth/mature) 프로파일 → 추천 (실행가능 게이트: 첫 주문 ≤ 자본 30%)
- 포트폴리오: MOQ 양자화 주문 라인 + 예상 수익
- 프라이싱: Tier×난이도 가격표 + 구독 플랜
- 컴플라이언스: KC/전파/전안법/식약처 **결정적 규칙** 판정 (LLM 아님 — 의도적)
- 알림룰: 사용자 정의 룰 평가 (sweep/new_product 이벤트) → Discord

### `src/discordAlerter.ts` (167줄)
고ROI 알림 + **OpenClaw 핸드오프 JSON 페이로드** 임베드. `DISCORD_WEBHOOK_URL` 없으면 no-op. ROI 임계 `ROI_ALERT_MIN_PERCENT`(기본 40) 또는 프로파일 매칭 시 발화.

---

## 5. 관찰성 — `src/observability.ts` (239줄)

- **import 순서 규칙**: server.ts에서 `import 'dotenv/config'` 다음 `import './observability'`가 express보다 **먼저** 와야 함 (auto-instrumentation 패치 타이밍)
- 메트릭 접두 `seondal_*`: payment_challenges/verifications/replay/expired/revenue/active_gauge, scrape, db_operations, gcs_uploads, discord_alerts, comparator, profile_matches, coupang_observations, http duration
- `logEvent(level, event, fields)` — JSON 라인 + 활성 스팬의 trace_id/span_id 자동 주입
- `/metrics` + `/api/health` 엔드포인트

## 6. 인프라

- `Dockerfile` — 멀티스테이지 (node:24, tsc → dist). `.dockerignore` 참고
- `k8s/seondal-pay/` — Deployment(2r, 프로브 /api/health, **cloud-sql-proxy 사이드카**, 시크릿 마운트 optional), Service(LB), ServiceMonitor(`release: kube-prometheus-stack` 라벨 필수), ConfigMap
- `argocd/` — app-of-apps: seondal-pay + kube-prometheus-stack + loki + tempo + otel-collector + monitoring-extras(대시보드 ConfigMap·PrometheusRule)
- **Autopilot 함정**: kube-system read-only → kubelet/컨트롤플레인 모니터 비활성화 필수; CRD 256KB → ServerSideApply; loki-stack의 isDefault datasource 충돌 주의
- `scripts/bootstrap_gke.sh` — 시크릿 생성(.env 라인별 파싱, 따옴표 제거) + ArgoCD 설치 + root app

## 7. 실험 — `experiments/` (Python)

- `exp1_ontology.py`: 원문 vs 온톨로지 (200 calls, 시드 20260802, 조걳별 별도 키, 결정적 룰 채점)
- `exp2_multiagent.py`: 통합 vs 역할분해 vs 타입드 핸드오프 (openai-agents SDK, `RUN_ONLY=C` 지원)
- `audit_exp1_verify.py`: 응답 전문 캡처 감사
- **K3 제약**: temperature=1 고정 (determinism은 reasoning_effort=low로)

## 8. 다음 과제 (우선순위)

1. **실제 1688 파싱** (scraper의 합성 속성 제거) — MOQ/무게/공장을 진짜 페이지에서
2. **Coupang Partners 키** 승인 시 `coupangPartnersClient` 즉시 활성화
3. **MPP pull mode** (payload.type=transaction 서버 브로드캐스트) + SPL/USDC
4. **관측값 영속화** (observations → Cloud SQL 테이블)
5. **공식 MCP SDK 이행** (streamable HTTP/SSE, resources/prompts)
6. **ODK CI** (ROBOT reasoner QC on PR)
