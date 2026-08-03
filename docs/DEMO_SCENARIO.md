# 🎬 SEONDAL Pay — 데모 영상 촬영 순서표 (최종 개선판, 3분 컷)

> **최종 검증 및 개선일**: 2026-08-03
> **개선 핵심**: ①자막(Subtitle) 전면 추가 ②'SaaS 요청 → 402 결제 → 온체인 서명 → 정산 언락' 자연스러운 서사 구성 ③3분 이내 완벽 타이밍 타이트 구성.

---

## 📌 3분 영상 스크립트 & 자막(Subtitle) 총괄표

| 구간 | 장면 (Visual) | 주요 액션 | 💬 추천 화면 자막 (Subtitles) |
|---|---|---|---|
| **0:00–0:20** | **Act 1. 문제 제시 & 소싱 요청** | SaaS 콘솔 챗에 `"유아 롬퍼"` 입력 | `"1688 도매가 ₩32,472 vs 국내 소매가 ₩56,013 — AI 에이전트가 마진을 자동 추적합니다."`<br>`"유저의 데이터 요청 시 402 Payment Required 챌린지가 발급됩니다."` |
| **0:20–1:05** | **Act 2. 온체인 자율 결제** | 터미널 `agent.ts` 실행 + Solscan 서명 확인 | `"HTTP 402 Payment Required 감지 — 예산 정책 범위(0.05 SOL) 자율 판단"`<br>`"사람의 개입 없이 Solana Devnet 상에서 무승인 서명 및 트랜잭션 전송"`<br>`"Solscan 검증: Memo에 externalId 식별자 온체인 영구 각인 완료"` |
| **1:05–1:40** | **Act 3. SaaS 콘솔 정산 & 언락** | 대시보드 새로고침 (지갑 잔액 ↑) + Tier 3 리포트 언락 | `"결제 직후 Tier 3 심층 마진 리포트(ROI 72.5%) 실시간 언락!"`<br>`"상점/공급자 지갑 잔액 실시간 증가 — 투명한 Instant Settlement 실현"` |
| **1:40–2:15** | **Act 4. 생태계 연동 & 운영 강건성** | Discord `#seondal-alerts` 알림 + Grafana / ArgoCD | `"Discord 자동 연동: 고마진 포착 시 OpenClaw 에이전트로 Handoff"`<br>`"ArgoCD 자가치유(Self-Healing) & Grafana Tempo(Trace ID) 실시간 관측성"` |
| **2:15–3:00** | **Act 5. 실험 수치 & 클로징** | 정지 수치 카드 3장 + 라이브 URL & QR | `"검증된 성과: 온톨로지 토큰 -81.4%, 정확도 98%, 타입드 JSON 90% 회복"`<br>`"Standard: draft-solana-charge-00 wire-compatible 준수"`<br>`"Clear Insights, Fair Commerce by SEONDAL"` |

---

## Act 0. 촬영 전 체크리스트 (5분)

| # | 항목 | 확인 명령/위치 | 기대값 |
|---|---|---|---|
| 1 | Cloud Run 콘솔 | https://seondal-pay-1064390008895.us-central1.run.app | 로그인 화면 (`admin`/`admin`) |
| 2 | GKE 앱 API | http://34.46.201.195/api/health | `{"status":"ok"}` |
| 3 | Grafana | http://34.171.84.231 (admin/seondal-admin) | 대시보드 "SEONDAL Pay" 패널 |
| 4 | ArgoCD | https://136.116.158.227 | 전 앱 Synced/Healthy |
| 5 | 클라이언트 지갑 | `npx ts-node scripts/airdrop_test.ts` 잔액 확인 | ≥0.15 SOL (3회 결제분 이상) |
| 6 | Discord 채널 | #seondal-alerts 열어두기 | 웹훅 연동 확인 |
| 7 | 솔스캔 탭 | solscan.io?cluster=devnet | 트랜잭션 조회 준비 |

⚠️ **주의**: 잔액/히스토리가 신선하게 보이도록 촬영 직전 지갑 잔액을 확인합니다.

---

## 상세 액션 가이드

### Act 1. 콜드오픈 & 소싱 요청 (0:00–0:20)
- **화면**: Cloud Run SaaS 콘솔
- **동작**: 유저가 채팅창에 `"유아 롬퍼"` 입력 후 실행 버튼 클릭.
- **포인트**: 마진 분석 및 402 결제 필요 메세지 노출.

### Act 2. 온체인 자율 결제 — 핵심 샷 (0:20–1:05)
- **화면**: 좌) 터미널 (`npx ts-node src/agent.ts`) / 우) Solscan 탭
- **포착 로그**:
  1. `HTTP 402 Payment Required — MPP Challenge`
  2. `✓ Fee criteria matches (0.05 ≤ 0.06 SOL)`
  3. `Transaction signed autonomously`
  4. `Confirmed on-chain!` → Solscan Signature 붙여넣기 및 Memo 확인
  5. `🎉 Tier 3 Data Unlocked`

### Act 3. SaaS 콘솔 정산 & 언락 (1:05–1:40)
- **화면**: Cloud Run SaaS 콘솔
- **동작**: 
  1. 대시보드 새로고침 → 상점 지갑 잔액이 결제액만큼 즉시 증가된 것 포착.
  2. 채팅창에 ROI 72.5% 심층 리포트 카드 및 마진 분석 6단계 렌더링 확인.

### Act 4. Discord × 인프라 강건성 (1:40–2:15)
- **화면**: Discord `#seondal-alerts` & Grafana / ArgoCD
- **동작**:
  1. Discord 채널에 뜬 🔥 고마진 알림 카드 캡처.
  2. ArgoCD Synced 상태 및 Grafana Tempo 트레이스(payment→scrape→db) 확인.

### Act 5. 실험 수치 & 클로징 (2:15–3:00)
- **화면**: 수치 성과 요약 장미 카드 (토큰 -81.4%, 정확도 98%, RFC9457 준수) + 라이브 URL & QR.
- **슬로건**: *"Clear Insights, Fair Commerce by SEONDAL"*
