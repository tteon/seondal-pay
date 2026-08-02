# 🎬 SEONDAL Pay × OpenClaw — 데모 시나리오 (영상 촬영용)

> **한 줄 스토리**: AI 에이전트가 Solana M2M 결제로 검증된 소싱 데이터를 구매 →
> 고ROI 기회를 Discord로 알림 → 사용자의 개인 OpenClaw가 쿠팡 리스팅까지 수행.

---

## Act 0. 물리 준비 (5분)

| 항목 | 값 | 비고 |
|---|---|---|
| GKE 클러스터 | `seondal-cluster` (us-central1, Autopilot) | 실행 중 |
| ArgoCD UI | `kubectl get svc argocd-server -n argocd` → external IP | admin / 초기비밀번호 |
| Grafana | `kubectl get svc -n monitoring kube-prometheus-stack-grafana` → external IP | admin / seondal-admin |
| 앱 엔드포인트 | `kubectl get svc -n seondal seondal-pay` → external IP | 대시보드 + API |
| Discord 채널 | `#seondal-alerts` | 웹훅 연동됨 (Alertmanager + 앱 비즈니스 알림) |
| OpenClaw | 사용자 개인 인스턴스, 같은 Discord 서버 상주 | 쿠팡 리스팅 액션 보유 |

---

## Act 1. GitOps 강건성 (2분) — "인프라는 코드다"

1. ArgoCD UI 접속 → `seondal-root` app-of-apps 한 장면:
   `seondal-pay`, `kube-prometheus-stack`, `loki`, `tempo`, `otel-collector` 전부 **Synced/Healthy**.
2. **자기치유 시연**: 터미널에서
   `kubectl scale deployment/seondal-pay -n seondal --replicas=1`
   → ArgoCD가 drift를 감지하고 수 초 내 `replicas=2`로 되돌리는 화면.
3. GitHub 커밋 → ArgoCD 자동 sync → 롤링 업데이트 한 컷.

## Act 2. M2M 결제 (3분) — "에이전트가 스스로 돈을 낸다"

1. 터미널에서 Agent A 실행:
   ```bash
   SERVER_URL=http://<APP_IP>/api/scrape \
   MOCK_RPC_URL=http://<APP_IP>/api/mock-rpc/send-transaction \
   npx ts-node src/agent.ts
   ```
2. 로그에 순서대로 찍히는 것:
   - `HTTP 402 Payment Required` — MPP 챌린지 수신 (`WWW-Authenticate: Payment ...`)
   - 수수료 정책 체크 통과 → Solana 트랜잭션 자율 서명 (Memo에 externalId)
   - `Authorization: Payment` 크리덴셜 제출 → **`Payment-Receipt` 수신**
   - Tier 3 데이터 언락 (JSON-LD: 브랜드, MOQ, 한국 벤치마크가, ROI)
3. Grafana 대시보드로 전환 — 방금 결제가 실시간으로:
   - `Payment Verifications (rate)` 상승, `Verified Revenue (SOL)` 증가
   - 트레이스 상관: Loki 로그의 `trace_id` 하나로 `payment.verified → scrape.started → db.product_upserted` 한 줄 추적 시연.

## Act 3. Discord 알림 → OpenClaw (3분) — "사람은 승인만 한다"

1. Discord `#seondal-alerts` 채널에 **🔥 고ROI 소싱 기회 감지 — OpenClaw Handoff** 임베드 도착:
   - 상품/도매가/한국 벤치마크가/예상 ROI/결제 증명(solscan 링크)
   - `🤖 OpenClaw Handoff Payload` JSON 블록
2. 사용자가 Discord에서 OpenClaw에게 지시 (예: "이거 쿠팡에 올려줘").
3. OpenClaw가 페이로드를 읽고 쿠팡 리스팅 액션 수행 → 결과를 같은 채널에 회신.
4. (선택) 사용자가 `/api/orders/reserve` 호출로 1688 재고 예약까지 — 역시 Discord에 확인 알림.

## Act 4. 장애 대응 (1분) — "알림은 알아서 온다"

1. 파드를 강제로 죽인다: `kubectl delete pod -n seondal -l app=seondal-pay`
2. 2분 내: Grafana에서 `SeondalPayDown` firing → **Alertmanager → Discord** 경고 도착.
3. Autopilot이 파드를 자동 복구 → `resolved` 알림. (MTTR 수 분 이내 강조)

---

## 촬영 팁

- **한 화면 분할**: 좌측 터미널(agent 로그) / 우측 Discord — Act 2→3 연결감.
- Grafana 대시보드는 `?kiosk` 모드로 전체화면.
- OpenClaw 회신까지가 영상의 climax — Coupang 리스팅 완료 스크린샷으로 마무리.
- 모든 외부 IP/비밀번호는 촬영 전 `scripts/print_demo_endpoints.sh` 출력으로 한 번에 확인.
