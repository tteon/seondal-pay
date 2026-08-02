# 🧭 평가자 가이드 (Evaluator Quickstart)

> SEONDAL // Intelligence — 라이브 데모 체험 순서입니다. (소요 ~5분)

## 접속 정보

| 항목 | 값 |
|---|---|
| **SaaS Console** | https://seondal-pay-1064390008895.us-central1.run.app |
| **계정** | `evaluator@seondal.demo` / `seondal2026!` |
| Grafana (관찰성) | http://34.171.84.231 (admin / seondal-admin) |
| ArgoCD (GitOps) | https://136.116.158.227 (admin — 비밀번호는 제출 폼 메모 참조) |
| GitHub | https://github.com/tteon/seondal-pay |

## 체험 시나리오

### ① 온체인 결제 증명 확인 (1분)
1. Solscan(devnet)에서 실제 M2M 결제 트랜잭션 확인:
   https://solscan.io/tx/2VDRaQ9X1LZL7cqQbfCM5y2vYbDCMfsURZbofvR5JAK5cqYUZh9jjDiipHCmMeHdkiHyzc9UsFZc41TZECQM7BkH?cluster=devnet
2. Memo instruction 안의 `SEOCHO-…` externalId = 챌린지-결제 바인딩 확인

### ② SaaS Console 체험 (3분)
1. 로그인 → 타일 4개: **지갑 잔액(실시간 devnet 조회)**, 검증 매출, 활성 챌린지, 처리된 결제
2. **💬 라이브 소싱 에이전트** 챗에 `유아 롬퍼` 입력 → 실제 파이프라인 6단계(카탈로그 스캔 → MPP 402 챌린지 → 온톨로지 타이핑 → 쿠팡 판매자 추정 경제 → 프로파일 라우팅 → 리포트)가 순서대로 실행됨
3. **🥧 마켓 파이**: 그룹 칩(롬퍼·수유등·요가매트…)별 TOP5 판매 점유율 도넛 + 인컴턴트 테이블
4. **💰 마진 TOP5 도넛** + 상품 카탈로그 ROI 배지

### ③ MPP 프로토콜 직접 호출 (선택, 1분)
```bash
# 402 챌린지 + 표준 WWW-Authenticate 헤더 확인
curl -i -X POST https://seondal-pay-1064390008895.us-central1.run.app/api/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.aliexpress.com/item/1005006240212345.html","requestedTier":3}'
```

### ④ 관찰성/강건성 (선택)
- Grafana 대시보드 "SEONDAL Pay — Payments & Pipeline": 실시간 결제/크롤링/DB 메트릭
- ArgoCD: app-of-apps 전체 Synced/Healthy + GitOps 자기치유

## 참고 문서 (Repo 내)
- `docs/EXPERIMENTS.md` — 온톨로지 효용(토큰 −81%, 환각 0%) 및 멀티에이전트 실험 + 감사 트레일
- `docs/PPT_SOURCE.md` — 소개서 소스
- `docs/DEMO_SCENARIO.md` — 데모 영상 촬영 순서표
- `ontology/` — ODK 관리 온톨로지 (schema.org 확장, M2 중국 소싱 도메인)
