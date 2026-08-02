# 🎬 SEONDAL Pay — 데모 영상 촬영 순서표 (최종, 3분 컷)

> **검증 완료일**: 2026-08-02 — 아래 모든 샷은 실환경에서 사전 검증됨 (리허설 통과).
> **핵심 원칙**: 심사 기준 ①실온체인 결제 ②무승인 자율결제 ③Solana 스택 ④직관UX 를 시간축에 배치.

---

## Act 0. 촬영 전 체크리스트 (5분)

| # | 항목 | 확인 명령/위치 | 기대값 |
|---|---|---|---|
| 1 | Cloud Run 콘솔 | https://seondal-pay-1064390008895.us-central1.run.app | 로그인 화면 (admin/admin) |
| 2 | GKE 앱 | http://34.46.201.195/api/health | `{"status":"ok"}` |
| 3 | Grafana | http://34.171.84.231 (admin/seondal-admin) | 대시보드 "SEONDAL Pay" 8패널 |
| 4 | ArgoCD | https://136.116.158.227 | 전 앱 Synced/Healthy |
| 5 | 클라이언트 지갑 | `npx ts-node scripts/airdrop_test.ts` 잔액만 | ≥0.15 SOL (3회 결제분) |
| 6 | Discord 채널 | #seondal-alerts 열어두기 | 웹훅 연동됨 |
| 7 | 솔스캔 탭 | solscan.io?cluster=devnet | tx 붙여넣기 준비 |

⚠️ **촬영 전 agent 결제를 1회도 미리 돌리지 말 것** — 잔액/히스토리가 신선해야 "방금 결제"가 진짜로 보임.

---

## Act 1. 콜드오픈 — 문제 (0:00–0:15)

- **화면**: 콘솔 카탈로그 캡처 or 쿠팡/1688 가격 비교 스틸. 자막:
  > "1688 도매 ₩32,472 → 한국 소매 ₩56,013. 이 격차를 AI 에이전트가 스스로 '결제'해 검증합니다."
- **날고**: 정보 비대칭 문제 + SEONDAL 한 줄 소개.

## Act 2. 온체인 자율 결제 — 메인 샷 (0:15–0:45)

- **화면 분할**: 좌) 터미널 `SERVER_URL=http://34.46.201.195/api/scrape MOCK_RPC_URL=... npx ts-node src/agent.ts` / 우) solscan 탭
- **포착할 로그 라인** (순서대로 줌인):
  1. `HTTP 402 Payment Required — MPP Challenge: id=…, externalId: SEOCHO-…`
  2. `✓ Fee criteria matches (0.05 ≤ 0.06 SOL)` ← **예산 정책 자율 판단**
  3. `Transaction signed autonomously` ← **무승인 서명**
  4. `Confirmed on-chain!` → solscan에 시그니처 붙여넣기 → **Memo(externalId) 확대**
  5. `Payment-Receipt received` + `🎉 Tier 3 Data Unlocked`
- **날고**: "사람 승인 없이, 정책 안에서 에이전트가 직접 서명·결제·검증받습니다."

## Act 3. SaaS 콘솔 — 유저 가시성 (0:45–1:15)

- **Cloud Run 콘솔**에서:
  1. 로그인 → 타일 4개: **지갑 잔액이 Act 2 결제만큼 늘어난 것을 새로고침으로 비교** ← "실제 정산"의 가장 직관적 증거
  2. 카탈로그에 방금 결제된 상품 + ROI 배지 (🟢 고마진)
  3. 챗에 **"유아 롬퍼"** 입력 → 6단계 스텝이 순서대로 채팅 버블로 표시 → 리포트 카드 (ROI 72.5% 실측 사례)
- **날고**: "유저는 이 모든 걸 SaaS 콘솔에서 확인합니다."

## Act 4. Discord × OpenClaw (1:15–1:40)

- **Discord #seondal-alerts**: 🔥 고ROI 알림 임베드 도착하는 순간 캡처 (Act 2 결제가 트리거)
- `🤖 OpenClaw Handoff Payload` JSON 확대 → (가능하면) OpenClaw에 "쿠팡에 올려줘" → 액션 결과
- **날고**: "사람은 승인만 합니다. 실행은 에이전트 생태계가."

## Act 5. 강건성 — ArgoCD + Grafana (1:40–2:05)

- **ArgoCD UI**: 전 앱 Synced/Healthy 한 컷 → 터미널에서 `kubectl scale … --replicas=1` → **복귀 실연 (스피드업 편집 금지, 수십 초 실시간)**
- **Grafana**: 방금 결제가 `Payment Verifications`·`Verified Revenue (SOL)`에 실시간 반영 + Tempo 트레이스 1컷 (trace_id 하나로 payment→scrape→db 추적)
- **날고**: "데모가 아니라 운영 가능한 형태입니다."

## Act 6. 실험과 표준 (2:05–2:35)

- **수치 카드** (정지 화면 3장):
  1. 온톨로지: 토큰 **−81.4%**, 정확도 **98%**, 환각 **0%**
  2. 멀티에이전트: 자유 텍스트 50% → **타입드 JSON 90% 회복** (Rule 2.1 실증)
  3. 표준: `draft-solana-charge-00` wire-compatible + 이중지불/TTL/RFC9457
- **날고**: "주장이 아니라 측정입니다 — 재현 가능한 실험과 열린 표준."

## Act 7. 클로징 (2:35–3:00)

- 라이브 URL 3종 (Cloud Run 콘솔 / Grafana / ArgoCD) + GitHub QR (tteon/seondal-pay)
- 슬로건: **"Clear Insights, Fair Commerce by SEONDAL"**

---

## 촬영 팁

- **한 화면 분할 유지**: 좌 터미널 / 우 브라우저 — Act 2의 결제→Act 3의 잔액 변화 연결감
- Grafana는 `?kiosk` 전체화면
- 실패 테이크 대비: 클라이언트 지갑 잔액 3회분 확보 후 촬영 시작 (0.15 SOL+)
- 모든 외부 IP는 Act 0 표의 값을 그대로 자막에 사용
