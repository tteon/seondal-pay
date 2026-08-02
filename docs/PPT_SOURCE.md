# SEONDAL // Intelligence — 제출용 PPT 소스 문서

> 이 문서는 PPT 제작 에이전트가 **그대로 슬라이드로 변환**할 수 있도록 작성된 소스입니다.
> 각 섹션 = 슬라이드 1장. `🎯 핵심 메시지`는 슬라이드 헤드라인, `📝 발표 노트`는 스피커 노트,
> `🎨 시각 자료`는 다이어그램/이미지 배치 지시입니다.

---

## 슬라이드 1. 표지

- **제품명**: SEONDAL // Intelligence (선달 인텔리전스)
- **슬로건**: *Clear Insights, Fair Commerce by SEONDAL*
- **부제**: AI 에이전트가 스스로 결제하고 검증하는 이커머스 소싱 데이터 플랫폼
- **한 줄 정의**: 이커머스 정보 비대칭성을 Solana M2M 마이크로페이먼트와 에이전트 온톨로지로 해소하는 B2B 에이전틱 커머스 OS
- 🎨 시각 자료: 마스코트(갓 쓴 AI 에이전트 + 분석 태블릿) `src/public/assets/seondal_mascot.jpg`

📝 발표 노트: "봉이 김선달이 대동강 물을 판 것이 아니라 '정보'를 판 것처럼, 우리는 검증된 소싱 정보를 에이전트끼리 거래하게 만듭니다."

---

## 슬라이드 2. 문제 정의 (Problem)

🎯 **"1688 공장가 1.2만 원짜리가 한국에서는 5.4만 원 — 이 격차를 아는 사람만 돈을 법니다"**

1. **정보 비대칭 (Information Asymmetry)**
   - 중국 1688/타오바오 도매가 vs 한국 소매가의 마진 구조가 소수 전문 셀러에게만 암묵지로 존재
   - 초보 셀러는 소싱처, 관세, KC 인증, 물류비를 종합한 *랜디드코스트*를 계산할 도구가 없음
2. **데이터는 있는데 살 수 없다**
   - 유용한 소싱 데이터는 웹에 흩어져 있고(노이즈 99%), 기계가 즉시 구매할 표준 수단 부재
   - 기존 API 구독/계정/PG 결제는 **사람 전제** — AI 에이전트가 회원가입·카드등록·구독 관리를 할 수 없음
3. **법규 리스크**
   - 플랫폼이 원화를 예치·중개하면 전자금융거래법상 PG 등록 의무(제28조)·자금세탁 이슈 발생
4. **품질 검증 불가**
   - 크롤링 원문을 그대로 에이전트에 넣으면 환각/노이즈가 연쇄 증폭 (A2A cascade error)

📝 발표 노트: 고객 인터뷰 페르소나 — "초기 자본 300만 원의 30대 예비 셀러, 무엇을 사야 할지, 얼마에 팔아야 할지, 재고 리스크는 얼마인지 매일 검색만 3시간"

---

## 슬라이드 3. 해결을 위한 우리의 시도 (Approach)

🎯 **"에이전트가 0.05 SOL을 스스로 결제하고, 검증된 데이터를 받아, Discord로 당신에게 제안합니다"**

| # | 시도 | 내용 |
|---|---|---|
| 1 | **MPP 표준 결제 레이어** | HTTP 402 + Solana로 계정·API키 없는 M2M 즉시 결제 (`draft-solana-charge-00` 구현) |
| 2 | **온톨로지 노이즈 감소** | 크롤링 원문 → JSON-LD 타입드 노드 변환 후 A2A 전달 (원시 텍스트 직접 전달 금지) |
| 3 | **쿠팡↔1688 지속 비교** | 랜디드코스트(도매가×환율+국제물류+관세) vs 한국 소매가 마진 곡선 자동 산출 |
| 4 | **관심 프로파일 라우팅** | "카테고리 = 금융 프로파일" (ROI 밴드·마진·리스크 성향)로 기회를 개인화 추천 |
| 5 | **Discord × OpenClaw 핸드오프** | 고ROI 감지 → Discord 알림 → 개인 OpenClaw가 쿠팡 리스팅까지 수행 |
| 6 | **실운영급 GitOps** | GKE Autopilot + ArgoCD + Prometheus/Grafana/Loki/Tempo 풀스택 관찰성 |

📝 발표 노트: 각 항목은 데모 영상의 한 챕터와 1:1로 대응됨. "슬라이드가 아니라 돌아가는 시스템으로 증명한다"가 팀 원칙.

---

## 슬라이드 4. 세부 프로세스 (End-to-End Flow)

🎯 **결제 0.05 SOL부터 쿠팡 리스팅 제안까지 — 8단계 자동 파이프라인**

```
Agent A(구매 에이전트)                Agent B(SEONDAL 서버)
       │ POST /api/scrape (무결제)            │
       │ ─────────────────────────────────▶ │ ① 402 + WWW-Authenticate: Payment
       │                                     │    (JCS 정규화 charge: 금액/수신자/externalId/TTL)
       │ ② 수수료 정책 검증 (≤0.06 SOL)        │
       │ ③ SOL 전송 + Memo(externalId) 서명    │
       │    → Solana devnet (또는 Mock 샌드박스) │
       │ Authorization: Payment <credential> │
       │ ─────────────────────────────────▶ │ ④ 온체인 검증: 금액·수신자·메모 바인딩
       │                                     │    + 리플레이 차단 + TTL 강제
       │ ◀───────────────────────────────── │ ⑤ 200 + Payment-Receipt
       │                                     │ ⑥ 크롤링 → JSON-LD 온톨로지 저장(GCS+DB)
       │                                     │ ⑦ 컴패레이터: 마진/ROI 산출
       │                                     │ ⑧ 프로파일 매칭 → Discord 알림
       ▼                                     ▼
              📱 Discord: 🔥 고ROI 소싱 기회 + 🤖 OpenClaw Handoff Payload
                              → 사용자 승인 → OpenClaw → 쿠팡 리스팅
```

- **암호학적 바인딩**: 챌린지의 `externalId`가 온체인 Memo instruction에 박혀 결제↔주문 1:1 대응
- **이중지불 방지**: 소비된 서명 전역 거부 (MPP §10.5), 챌린지 TTL 300초
- **실패 안전**: RFC 9457 problem+json + 새 챌린지 자동 재발행; devnet 장애 시 Mock 샌드박스 폴

🎨 시각 자료: 위 시퀀스를 8개 스텝 아이콘 플로우로. 온체인 구간(③④)만 Solana 그라데이션 강조.

---

## 슬라이드 4-2. 핵심 기술: 온톨로지 제품 그래프 — 노이즈 ↓ 토큰 ↓ 비용 ↓

🎯 **"크롤링 원문 48,500 토큰 → 온톨로지 노드 1,420 토큰 (97% 절감) — 에이전트 비용이 곧 사용자 부담입니다"**

1. **문제**: 1688/타오바오 원문 HTML은 99% 노이즈. 원문을 그대로 에이전트에 넣으면 ① 토큰 비용 폭증 ② 환각 연쇄 증폭(cascade error) ③ A2A 추론 정확도 붕괴
2. **우리의 방법 — schema.org/Product 정합 JSON-LD 타이핑**
   - 원문 → `Product` 타입드 노드(brand, offers.moq, priceSpecification, additionalProperty: Shipping Weight/Material/Factory Location/Korean Benchmark/ROI)
   - **Rule 2.1 (AGENT.md)**: A2A 간 원시 텍스트 전달 금지 — 온톨로지 노드만 전달
3. **AWS Ontology Mining 방법론의 실전 적용**
   - *Taxonomy Enrichment*: 신규 카테고리(예: 코코넛 플라워 같은 emerging 상품)를 기존 분류 트리에 hypernym/synonym 관계로 부착 — 우리의 `ontologyMining.ts`가 카테고리 마이닝·속성 중요도 부여
   - *Relation Discovery*: Attribute Applicability(이 속성이 이 카테고리에 적용 가능한가) / Importance(구매 결정에 중요한가) — Tier 2 필터링에서 "한국 벤치마크가/ROI는 Tier 3 전용"으로 중요도 분리한 것이 그 구현
   - *고객 행동 신호*: 관심 프로파일(ROI 밴드·리스크)이 검색/클릭 행동 신호 역할
4. **비용 정당성**: 토큰 97% 절감 → LLM 호출 비용 동비율 절감 → **사용자가 에이전트를 굴리는 단가 자체가 낮아짐** = 수익 모델(Tier 마이크로페이먼트)의 원가 경쟁력
5. **ODK 라이프사이클 (git 기반 온톨로지 버저닝)**
   - 온톨로지를 코드처럼: [INCATools ODK](https://github.com/INCATools/ontology-development-kit)(ROBOT·reasoner·릴리스 워크플로)로 OWL 소스 버전관리 → CI에서 QC(일관성 추론) → 릴리스 아티팩트(OWL/JSON-LD export)를 런타임이 소비
   - **실제 저장소 적용**: `ontology/seondal-product.ofn` — schema.org/Product 정합 코어 클래스(Product, ProductOntologyNode, UserCircumstanceNode, TariffComplianceNode, InterestProfile, MarginSnapshot) + taxonomy enrichment 관계(hypernym/synonym), **dated version IRI**(`…/2026-08-02`)로 릴리스 버저닝
   - 즉 온톨로지도 ArgoCD와 같은 **GitOps 라이프사이클** — 편집→검증→배포가 선언적 (인프라 GitOps와 동일 철학)

🎨 시각 자료: 좌측 "원문 HTML 48.5K tokens (회색)" → 온톨로지 필터 → 우측 "1.4K tokens (녹색)" 빅 넘버 비교 + taxonomy 트리에 NEW 노드 부착되는 다이어그램.

---

## 슬라이드 5. 웹 페이지 & 인터페이스 순서 (UI Walkthrough)

🎯 **평가자가 따라 할 수 있는 5개 화면 여정**

| 순서 | 화면 | 보여줄 것 |
|---|---|---|
| 1 | **CommerceOS 대시보드** (앱 루트) | SEONDAL 브랜드 대시보드 — 저장된 소싱 리포트 리스트, 3개 분석 차트, KC 체크리스트 |
| 2 | **대화형 Intent AI 허브** (Tab 2) | 자연어 소싱 질의 → AI 응답 → "💾 리포트로 저장" → Tab 1 카드 자동 생성 |
| 3 | **결제 플로우 로그** (터미널/대시보드) | 402 챌린지 → 서명 → `Payment-Receipt` 실시간 표시 |
| 4 | **Grafana "SEONDAL Pay" 대시보드** | 매출(SOL), 검증 성공/실패율, 리플레이 차단, 크롤링 p95 — 실시간 갱신 |
| 5 | **ArgoCD UI** | app-of-apps 1장: seondal-pay + 모니터링 5개 앱 전부 Synced/Healthy |
| +α | **Discord 채널** | 고ROI 알림 임베드 + OpenClaw 핸드오프 페이로드 + Alertmanager 인프라 알림 |

📝 발표 노트: 각 화면은 라이브 URL로 공개 (가산점 항목). UI → API → 온체인 → 관찰성 → 협업 채널 순으로 "시스템의 깊이"를 보여주는 순서.

---

## 슬라이드 6. 왜 pay.sh 인가 (Why pay.sh / Solana MPP)

🎯 **"사람이 아니라 기계가 손님인 시대의 결제 표준"**

| 기준 | PG/카드 결제 | API 구독제 | **pay.sh (MPP on Solana)** |
|---|---|---|---|
| 고객 | 사람 | 사람+조직 | **AI 에이전트 (M2M)** |
| 계정/가입 | 필요 | 필요 | **불필요 (지갑만)** |
| 단위 결제 | 최소 수천 원 | 월 구독 | **0.001 KRW급 마이크로페이먼트** |
| 정산 속도 | D+2~7 | 월 정산 | **400ms~2초 온체인 확정** |
| 법적 구조 | PG 등록 의무(전금법 §28) | 선불/정기결제 규제 | **Zero-Custody (무수탁)** |
| 표준 | 사업자별 폐쇄 | 사업자별 폐쇄 | **HTTP 402 오픈 표준 (MPP/x402)** |

- **법적 근거**: 플랫폼이 원화를 한 점 만지지 않음(무수탁) → 전자금융거래법 PG 등록 의무 회피, 제18조 위임 결제 리스크 없음
- **기술 근거**: Solana Foundation의 `pay` CLI·`paymentauth.org` MPP 표준과 와이어 호환 — 공식 스펙(`draft-solana-charge-00`)의 챌린지/크리덴셜/영수증/리플레이 규칙을 그대로 구현
- **미래 근거**: stablecoin(USDC) 정산·facilitator 분리(x402 v2)로 확장 가능한 구조

📝 발표 노트: "pay.sh를 선택한 것이 아니라, M2M 시대에 원화 PG로는 답이 없어서 표준을 구현했습니다. 다만 표준 그대로가 아니라 저희 도메인(Tier 데이터, 컴패레이터, 알림)에 맞게 확장했습니다."

---

## 슬라이드 7. 왜 Google Cloud 인가 (Why GCP)

🎯 **"에이전트 플랫폼은 에이전트 친화적 클라우드에서"**

1. **GKE Autopilot** — 노드 관리 제로. GitOps(ArgoCD)만으로 2 replica 서비스 + 모니터링 5스택이 선언적으로 운영됨. 평가자 공개용 LoadBalancer 즉시 발급
2. **Artifact Registry + Cloud Build** — 소스→이미지→배포가 한 프로젝트 안에서 닫힘
3. **Cloud SQL (PostgreSQL, JSONB+GIN)** — JSON-LD 온톨로지 문서를 관계형 무결성으로 저장·검색
4. **Cloud Storage** — 크롤링 원본 HTML/이미지의 불변 아카이브 (감사·재처리용)
5. **비용 구조** — Autopilot 사용량 과금 + 최소 티어로 데모 운영, 평가 후 즉시 축소 가능
6. **생태계 친화** — Gemini 기반 `agy` 에이전트가 GCP를 네이티브로 조작 (다음 슬라이드)

🎨 시각 자료: GCP 아이콘 조합 (GKE ▸ AR ▸ Cloud SQL ▸ GCS) + "한 프로젝트 안의 폐쇄 루프" 강조.

---

## 슬라이드 8. 멀티 에이전트 협업 — agy로 무엇을 했는가

🎯 **"이 인프라는 두 AI 에이전트가 협업해서 배포했습니다"**

- **역할 분담**: Claude(오케스트레이션·MPP 프로토콜·도메인 로직) × agy/Gemini(GCP 네이티브 작업)
- **agy가 실제 수행한 것**
  1. IAM 권한 부여 시도 → **실패 원인 정확히 분석** (SA의 `setIamPolicy` 부재 = 셀프 승격 불가) → 사람(owner) 액션으로 정확히 에스컬레이션
  2. `bootstrap_gke.sh`의 **.env 따옴표 파싱 버그를 자율 수정** (kubectl `--from-env-file` 인용 처리 결함) → 커밋
  3. K8s 시크릿 2종 생성 (`seondal-secrets`, `alert-discord-webhook` — Discord 웹훅의 `/slack` 변환 포함)
  4. ArgoCD root Application 적용 및 상태 보고
- **협업 프로토콜**: Claude가 미션 브리프 작성 → agy 자율 실행 → 구조화 보고 → Claude가 검증/커밋
- **시사점**: 플랫폼이 판매하는 것(A2A 자동화)을 **우리 자신의 개발·운영 과정에도 적용** — "우리가 만드는 것을 우리가 이미 살고 있다"

📝 발표 노트: 심사 포인트 — 에이전트를 "쓴" 것이 아니라 에이전트끼리 "일하게 한" 사례. 실패 에스컬레이션까지 자연스러웠음이 신뢰의 증거.

---

## 슬라이드 9. 시스템 아키텍처 — 제품화 의향의 반증

🎯 **"데모용 토이가 아니라, 내일 팔 수 있는 형태로 배포했습니다"**

> **제품화 증거 체크리스트** — 각 항목이 "프로토타입"과 "제품"을 가르는 기준:
> ✅ GitOps(ArgoCD app-of-apps): 인프라 전체가 Git에 선언적으로 존재, drift 자동 복구
> ✅ GKE Autopilot: 노드 무관리 운영, LoadBalancer로 평가자 실접속 가능
> ✅ 풀스택 관찰성: Prometheus(메트릭) + Grafana(대시보드) + Loki(로그) + Tempo(트레이스) + Alertmanager(Discord 알림)
> ✅ 보안: 시크릿 제로 커밋, K8s Secret 주입, RFC 9457 에러, 이중지불 방지
> ✅ 재현 가능: `git clone` → quickstart → E2E 테스트 7종
> ✅ 프로토콜 표준: MPP(`draft-solana-charge-00`) 와이어 호환 — 공식 `pay` CLI와 상호운용 설계

```
                        ┌──────────────── GitHub: tteon/seondal-pay ────────────────┐
                        │  src/ (MPP·컴패레이터·관찰성)  k8s/  argocd/  dashboards  │
                        └───────────────┬───────────────────────────────────────────┘
                                        │ git poll (3분)
                                        ▼
   GKE Autopilot (us-central1)   ┌─ ArgoCD (app-of-apps) ──────────────────────────┐
   ┌─────────────────────────────┼─────────────────────────────────────────────────┤
   │                             ▼                                                 │
   │  ┌─ ns: seondal ─────────┐   ┌─ ns: monitoring ────────────────────────────┐  │
   │  │ seondal-pay ×2 (LB)   │   │ Prometheus ─ Alertmanager ─▶ Discord 🔔     │  │
   │  │  /api/scrape (402)    │   │ Grafana (LB, 대시보드 자동프로비전)          │  │
   │  │  /metrics  /api/health│──▶│ Loki(로그)  Tempo(트레이스)  OTel Collector │  │
   │  └───────┬───────────────┘   └─────────────────────────────────────────────┘  │
   └──────────┼───────────────────────────────────────────────────────────────────┘
              │ OTLP/:4318                 │ /metrics scrape        │ JSON stdout
   ┌──────────▼─────────────┐   ┌──────────▼───────────┐   ┌───────▼────────┐
   │ Solana devnet          │   │ Cloud SQL (JSON-LD)  │   │ GCS (원본 HTML/ │
   │ (결제·Memo·영수증)      │   │ GCS mock → prod 전환  │   │ 이미지 아카이브) │
   └────────────────────────┘   └──────────────────────┘   └────────────────┘
              ▲
   Agent A(구매 에이전트) ── 402 challenge → 서명 → Authorization: Payment
              │
   Discord #seondal-alerts ──▶ 사용자 ──▶ OpenClaw ──▶ Coupang 리스팅
```

- **무수탁 결제**: 플랫폼은 검증만, 자금 이동은 온체인 P2P
- **3중 관찰성**: Metrics(Prometheus) + Logs(Loki, trace_id 상관) + Traces(OTLP→Tempo)
- **자기치유**: ArgoCD가 drift 감지 시 Git 상태로 자동 복귀 (데모 Act 1에서 실연)

---

## 슬라이드 10. 수익 모델 (Business Model)

🎯 **"구독이 아니라, 데이터가 팔릴 때마다 0.005~0.05 SOL"**

1. **Tier 마이크로페이먼트 (현재 구현)**
   - Tier 1 `0.005 SOL`: 기본 메타데이터 / Tier 2 `0.015`: 물류·도매 스펙 / Tier 3 `0.050`: 한국 벤치마크가·ROI 분석
   - 결제 금액 = 데이터 접근 깊이 (서버 측 페이로드 필터링으로 강제)
2. **API 게이트웨이 수익 집계 (현재 구현)** — 에이전트별 API 키, 누적 SOL 매출 대시보드
3. **확장 로드맵**
   - **데이터 큐레이션 수수료**: 쿠팡↔1688 컴패레이터 프리미엄 피드 (프로파일별 알림)
   - **파트너 데이터 스토어**: 검증된 공급처 데이터 제공자에게 수익 공유 (스토어 수수료 15%)
   - **엔터프라이즈 프라이빗 배포**: 소싱 에이전시/유통사 사내 GKE 배포 + 커스텀 온톨로지
4. **비용 구조**: SOL 수수료 ~0.000005 SOL/tx — 마진율 사실상 99%+; 인프라는 Autopilot 사용량 과금

📝 발표 노트: M2M 결제라 **결제 자체가 제품의 사용 증거** — 사용량 지표가 곧 매출 지표(투자자 관점의 깔끔한 단위경제).

---

## 슬라이드 11. 도입 시나리오 (Go-To-Market)

🎯 **타깃: 크로스볼셀러(초기) → 소싱 에이전시(성장) → 에이전트 플랫폼(확장)**

| 단계 | 타깃 | 시나리오 | 성공 지표 |
|---|---|---|---|
| **PoC (현재)** | 평가 기관/해커톤 | 라이브 URL + 3분 데모: M2M 결제→Discord→OpenClaw | 온체인 결제 재현 성공률 100% |
| **파일럿 (1~3개월)** | 초기 셀러 50명 (Discord 커뮤니티) | 관심 프로파일 등록 → 주간 고ROI 알림 → 쿠팡 리스팅 전환 | 알림→리스팅 전환율, 재구매(재결제)율 |
| **상용 (3~12개월)** | 소싱 에이전시/유통 SMB | Tier 데이터 API 무제한 에이전트 액세스 + 프라이빗 배포 | 월 M2M 결제 건수, Tier 3 비중 |
| **확장** | 에이전트 플랫폼 (OpenClaw 생태계) | pay.sh 스킬 마켓플레이스 등재, facilitator 파트너 | 외부 에이전트 호출 비중 |

📝 발표 노트: OpenClaw 같은 개인 에이전트 생태계가 커질수록 "결제 레일"의 가치는 커진다 — 우리는 앱이 아니라 **레일**을 판다.

---

## 슬라이드 12. 검증 & 강건성 (Proof)

🎯 **"주장이 아니라 측정"**

- **프로토콜 테스트 7종 전부 통과** (`scripts/test_mpp_flow.ts`):
  정상 결제+영수증 / 서명 재사용 차단 / 챌린지 변조 차단 / TTL 만료 차단 / 레거시 호환 / devnet 메모 디코딩 / 자율 에이전트 3연속 결제
- **관찰성 검증**: `payment.verified → scrape.started → db.product_upserted`가 하나의 `trace_id`로 추적됨 (Loki↔Tempo 상관)
- **알림 룰 7종**: 서비스 다운 / 5xx 급증 / 검증 실패 스파이크 / 리플레이 스톰 / 챌린지 만료율 / 폴찌 백 과다 / Discord 전송 실패
- **GitOps 자기치유**: 수동 스케일 조작 → ArgoCD가 Git 상태로 자동 복귀 (데모 Act 1 실연)
- **보안**: 시크릿 제로 커밋 (살균 커밋 이력), RFC 9457 에러, 이중지불 방지, TTL 강제

---

## 슬라이드 13. 데모 영상 구성 (3분) — 촬영 대본

🎯 **"에이전트가 돈을 내는 순간을 보여드립니다"**

| 시간 | 장면 | 내용 |
|---|---|---|
| 0:00~0:20 | 타이틀 + 문제 1컷 | "1688 공장가 vs 한국 소매가 — 정보 비대칭" |
| 0:20~0:50 | ArgoCD self-heal | 레플리카 수동 조작 → 자동 복귀 (강건성) |
| 0:50~1:50 | **M2M 결제 전 과정 (메인)** | Agent A 실행 → 402 → 서명 → **온체인 확정** → Receipt → 데이터 언락 (화면 분할: 로그/솔스캔) |
| 1:50~2:20 | Grafana + Discord | 실시간 메트릭 상승 → 🔥 고ROI 알림 도착 |
| 2:20~2:50 | OpenClaw | Discord에서 "쿠팡에 올려줘" → 리스팅 완료 |
| 2:50~3:00 | 클로징 | 라이브 URL 3종 + GitHub QR |

- 상세 촬영 가이드: `docs/DEMO_SCENARIO.md` (Act 0~4)
- ⚠️ **사전 준비**: 클라이언트 지갑에 devnet SOL (faucet 레이트리밋 대비 미리 충전)

---

## 슬라이드 14. 로드맵 & 링크

- **단기**: 라이브 devnet CI (faucet 펀딩), MPP pull 모드, Coupang Partners API 연동 (공식 가격 소스)
- **중기**: USDC(SPL) 정산, facilitator 분리(x402 v2), ODK 기반 온톨로지 릴리스 파이프라인, Python AI 추론 pod
- **장기**: pay.sh 스킬 마켓플레이스, 다중 체인 정산, 엔터프라이즈 프라이빗 배포
- **링크**
  - GitHub: https://github.com/tteon/seondal-pay
  - 라이브 앱/대시보드: `http://<APP_LB_IP>` (제출 시점 확정값으로 교체)
  - Grafana: `http://<GRAFANA_LB_IP>` (admin / 문의)
  - ArgoCD: `https://<ARGOCD_IP>` (평가자 열람 가능)

---

## 부록 A. 재현 방법 (평가자용 Quickstart)

```bash
git clone https://github.com/tteon/seondal-pay && cd seondal-pay
npm install && npm run build
PORT=3000 npx ts-node src/server.ts &                      # 서버 (mock 자동 폴찌)
npx ts-node scripts/test_mpp_flow.ts                       # 프로토콜 E2E 7종
SERVER_URL=http://localhost:3000/api/scrape \
MOCK_RPC_URL=http://localhost:3000/api/mock-rpc/send-transaction \
npx ts-node src/agent.ts                                    # 자율 결제 에이전트
```

## 부록 B. 핵심 코드 맵 (심사자 코드 리뷰 가이드)

| 파일 | 역할 |
|---|---|
| `src/mppEngine.ts` | MPP 표준 엔진 (JCS, 챌린지 TTL, 크리덴셜, 영수증) |
| `src/server.ts` | Agent B — 402 발행, 온체인 검증, Tier 필터링 |
| `src/agent.ts` | Agent A — 자율 정책 검증·서명·제출 |
| `src/comparatorEngine.ts` | 쿠팡↔1688 마진 곡선 (랜디드코스트) |
| `src/interestProfileEngine.ts` | 금융 프로파일 매칭·라우팅 |
| `src/discordAlerter.ts` | Discord 임베드 + OpenClaw 핸드오프 페이로드 |
| `src/observability.ts` | OTel/Prometheus/구조화 로그 |
| `argocd/`, `k8s/` | GitOps app-of-apps + 매니페스트 |
