# SEONDAL // Intelligence — 제출용 PPT 소스 문서

> 이 문서는 PPT 제작 및 평가용 **SEONDAL Pay 소개서 소스 문서**입니다.
> `scripts/generate_deck_pdf_v3.py`를 통해 `docs/SEONDAL_Pay_소개서.pdf`로 자동 컴파일됩니다.

---

## 슬라이드 1. 표지

- **제품명**: SEONDAL // Intelligence (선달 인텔리전스)
- **슬로건**: *Clear Insights, Fair Commerce by SEONDAL*
- **부제**: AI 에이전트가 스스로 결제하고 검증하는 이커머스 소싱 데이터 플랫폼
- **한 줄 정의**: 이커머스 정보 비대칭성을 Solana M2M 마이크로페이먼트와 온톨로지 지식그래프, 100-카테고리 벤치마크 데이터셋으로 해소하는 B2B 에이전틱 커머스 OS
- 🎨 시각 자료: 마스코트 `src/public/assets/seondal_mascot.jpg`

📝 발표 노트: "봉이 김선달이 대동강 물을 판 것이 아니라 '정보'를 판 것처럼, 우리는 검증된 소싱 정보를 에이전트끼리 자율 결제하고 거래하게 만듭니다."

---

## 슬라이드 2. 문제 정의 (Problem)

🎯 **"1688 공장가 1.2만 원짜리가 한국에서는 5.4만 원 — 이 격차를 아는 사람만 돈을 법니다"**

1. **정보 비대칭 (Information Asymmetry)**
   - 중국 1688/타오바오 도매가 vs 한국 소매가의 마진 구조가 소수 전문 셀러에게만 암묵지로 존재
   - 초보 셀러는 소싱처, RCEP 관세, KC 안전인증, 물류비를 종합한 *랜디드코스트*를 계산할 도구가 없음 (3~6개월 내 90% 이탈)
2. **M2M 결제 레일 부재**
   - 유용한 소싱 데이터는 웹에 흩어져 있고(노이즈 99%), 기계가 즉시 구매할 표준 수단 부재
   - 기존 API 구독/계정/PG 결제는 **사람 전제** — AI 에이전트가 회원가입·카드등록·구독 관리를 할 수 없음
3. **법규 & 금융 리스크**
   - 플랫폼이 원화를 예치·중개하면 전자금융거래법상 PG 등록 의무(제28조)·자금세탁 이슈 발생 (Solana Zero-Custody M2M 필요)
4. **품질 검증 & 환각 리스크**
   - 크롤링 원문을 그대로 에이전트에 넣으면 환각/노이즈가 연쇄 증폭 (A2A cascade error) → 온톨로지 노드 변환 필수

---

## 슬라이드 3. 해결을 위한 우리의 시도 (Approach)

🎯 **"에이전트가 0.05 SOL을 스스로 결제하고, 검증된 100-카테고리 벤치마크 데이터를 받아, Discord로 당신에게 제안합니다"**

| # | 시도 | 내용 |
|---|---|---|
| 1 | **MPP 표준 결제 레이어** | HTTP 402 + Solana로 계정·API키 없는 M2M 즉시 결제 (`draft-solana-charge-00` 구현) |
| 2 | **온톨로지 노이즈 감소** | 크롤링 원문 → JSON-LD 타입드 노드 변환 후 A2A 전달 (토큰 -81.4%, 환각 0%) |
| 3 | **15+ 카탈로그 & 100-카테고리 엔진** | 1688 공장가 × RCEP 관세 × 국제배송비 vs 쿠팡 벤치마크가 마진 곡선 자동 산출 |
| 4 | **KC 규제 가드레일** | 어린이 제품, 전기용품, 식기 등 KC 안전인증 필요 여부 결정론적 룰 엔진 1차 선별 |
| 5 | **Discord × OpenClaw 핸드오프** | 고ROI 감지 → Discord 알림 → 개인 OpenClaw가 쿠팡 리스팅까지 수행 |
| 6 | **실운영급 GitOps & 관찰성** | GKE Autopilot + ArgoCD + Prometheus/Grafana/Loki/Tempo 풀스택 관찰성 |

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
       │                                     │ ⑦ 컴패레이터: RCEP 관세/KC 규제/마진 산출
       │                                     │ ⑧ 프로파일 매칭 → Discord 알림
       ▼                                     ▼
              📱 Discord: 🔥 고ROI 소싱 기회 + 🤖 OpenClaw Handoff Payload
                             → 사용자 승인 → OpenClaw → 쿠팡 리스팅
```

---

## 슬라이드 5. 현대적 SaaS 콘솔 (Modern Glassmorphic UI)

🎯 **5개 메인 탭 기반의 고해상도 이커머스 소싱 인텔리전스 콘솔**

1. **📊 개요 & 지표 탭**: Merchant 지갑 잔액, MPP 결제 매출(SOL), 검증 성공 수, ROI 리더보드 & 순마진 TOP 5 차트
2. **📦 상품 카탈로그 (15+) 탭**: 의류, 주방, 펫, 테크, 가구 등 6대 영역 15개 고품질 상품의 수입원가 및 쿠팡가 실시간 연동
3. **🌐 100-카테고리 벤치마크 탭**: 10대 마크로 섹터 100개 카테고리의 Baidu 트렌드, RCEP 관세율, KC 인증 필요 여부 탐색기
4. **💬 라이브 에이전트 Console**: HTTP 402 Challenge부터 Solana Devnet Settlement까지 실시간 402 결제 소싱 대화 인터페이스
5. **🧺 포트폴리오 & 알림 탭**: 자본금(예: 300만 원) 맞춤 MOQ 발주 수량 생성기 및 Discord 알림 자동화 규칙 엔진

---

## 슬라이드 6. 왜 pay.sh / Solana MPP 인가

🎯 **"사람이 아니라 기계가 손님인 시대의 결제 표준"**

| 기준 | PG/카드 결제 | API 구독제 | **pay.sh (MPP on Solana)** |
|---|---|---|---|
| 고객 | 사람 | 사람+조직 | **AI 에이전트 (M2M)** |
| 계정/가입 | 필요 | 필요 | **불필요 (지갑만)** |
| 단위 결제 | 최소 수천 원 | 월 구독 | **0.001 KRW급 마이크로페이먼트** |
| 정산 속도 | D+2~7 | 월 정산 | **400ms~2초 온체인 확정** |
| 법적 구조 | PG 등록 의무(전금법 §28) | 선불/정기결제 규제 | **Zero-Custody (무수탁)** |
| 표준 | 사업자별 폐쇄 | 사업자별 폐쇄 | **HTTP 402 오픈 표준 (MPP/x402)** |

---

## 슬라이드 7. 실험적 증명 (Empirical Proof)

🎯 **"노이즈 99% 이커머스 환경에서 온톨로지 타이핑은 필수"**

| 조건 | 정확도 | 환각률 | 프롬프트 토큰 | 추정 비용 |
|---|---|---|---|---|
| 원시 텍스트 | 91~97% | 3~9% | 231,325 | 기준 |
| naive RAG | 88% | 11% | 124,431 | $0.606 |
| **온톨로지 노드 (SEONDAL)** | **98~100%** | **0%** | **43,985 (−81.4%)** | **$0.260 (−57%)** |

- **노이즈 절감**: 48.5K 토큰 원문 HTML → 1.4K 토큰 JSON-LD 노드로 97% 압축
- **A2A 파이프라인**: 자유 텍스트 전달 시 맥락 소실(정확도 50%) → 타입드 JSON-LD 전달 시 정확도 90% 회복

---

## 슬라이드 8. 확장 3분 데모 시나리오 (Demo Workflow)

🎯 **"자율 결제부터 규제 가드레일, 셀프힐링까지 3개 장면에 담다"**

- **Scene 1 (자율 결제 & MPP)**: 2030 여아 롬퍼 소싱 요청 → HTTP 402 Challenge → 0.05 SOL Solana Devnet 결제 → Payment-Receipt 발급
- **Scene 2 (RCEP & KC 가드레일)**: 스마트 펫 피더 vs 실리콘 식기 비교 → RCEP 관세율 및 KC 안전인증 필수 여부 자율 판정
- **Scene 3 (Dynamic Self-Healing)**: 1688 원가 변동 감지 및 ArgoCD GitOps 자동 복구 실연

---

## 슬라이드 9. 시스템 아키텍처 & 로드맵

- **GitOps 배포**: GKE Autopilot + ArgoCD app-of-apps + Cloud SQL (JSONB)
- **풀스택 관찰성**: Prometheus + Grafana + Loki + Tempo
- **로드맵**:
  - 단기: Discord 셀러 커뮤니티 50명 코호트 배포
  - 중기: USDC SPL 정산, x402 v2 Facilitator, UNI-PASS RAG
  - 장기: 글로벌 1688-쿠팡/아마존 M2M 결제 수수료 인프라 도약

---

## 링크 및 접속 정보

- **GitHub**: https://github.com/tteon/seondal-pay
- **SaaS Console**: `http://localhost:3000` (또는 Cloud Run 배포 URL)
- **Grafana**: `http://34.171.84.231` (admin / seondal-admin)
- **ArgoCD**: `http://136.116.158.227` (admin)
