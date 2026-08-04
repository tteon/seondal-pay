# AGENTS.md — SEONDAL Pay 작업 지침 (이 레포에서 일하는 모든 에이전트에게)

> 브랜드·도메인 규칙은 `AGENT.md` 참조. 이 파일은 **사용자가 직접 내린 운영 규칙과 결정사항**입니다.
> 코드 상세 지도는 `docs/CODEBASE_GUIDE.md`, 라이브 접속은 `docs/ACCESS.md`.

## 🔴 절대 규칙 (위반 금지)

1. **쿠팡 API는 상품 정볳만** — 정산(settlement)·주문·반품 엔드포인트는 절대 사용하지 않는다. 사용자가 명시한 경계.
2. **시크릿 커밋 금지** — API 키/키페어/.env는 항상 env 또는 K8s Secret으로. 커밋 전 스캔 필수. (과거 kimiClassifier 등에서 하드코딩 키 제거한 이력 있음)
3. **유저 노출 문구는 평문으로** — "랜디드코스트·MPP·온톨로지" 같은 전문 용어는 남발 금지. 초보 셀러가 읽는 챗/리포트/대시보드는 일상어로 (기술은 각주로).
4. **결과 날조 금지** — 실험/측정은 실제 호출만. 합성/mock 데이터는 반드시 라벨 표기.

## 🧪 실험 규칙 (사용자 합의 프로토콜)

1. **실행 전 설계를 보여주고 컨펌받는다** (측정 항목·평가 방법·성공 기준을 사전 등록)
2. **조걳별 별도 빌링 키**로 계량 분리 (`.env`의 KIMI_KEY_NON_ONTOLOGY / KIMI_KEY_ONTOLOGY)
3. **감사 트레일 필수**: 재집계 검증 + trace_id + 응답 캡처로 채점 정직성 입증
4. **Kimi K3 제약**: temperature는 1로 고정 — 결정성은 `reasoning_effort: 'low'`로
5. 실험 결과는 `docs/EXPERIMENTS.md`에 정직하게 (FAIL도 그대로)

## 🤝 협업 구조

| 역할 | 담당 | 노트 |
|---|---|---|
| 오케스트레이션·프로토콜·도메인 | Claude | MPP, 실험, 문서 |
| GCP 네이티브 작업 | **agy** (`/home/hadry/.local/bin/agy -p "..."`) | GKE/Cloud Run/IAM/배포. `--dangerously-skip-permissions`는 사용자 승인 시에만 |
| 쿠팡 브라우저 수집 | **OpenClaw** (사용자 로컬) | datacenter IP는 쿠팡 403 — 로컬 브라우저만 가능. 수집 지시서: `docs/OPENCLAW_TASK.md` |

- **병렬 작업 원칙**: 다른 에이전트/사용자가 같은 파일을 고칠 수 있다 — 덮어쓰기 전에 반드시 Read, 그들의 작업도 함께 커밋
- **agy 실패 시 에스컬레이션**: 권한 부족(IAM)은 사용자에게 정확한 명령어와 함께 보고

## 🔧 운영 함정 (실제로 겪은 것들)

- **git push**: 환경변수 `GITHUB_TOKEN`이 무효 — `credential.helper`가 `!env -u GITHUB_TOKEN gh auth git-credential`로 설정됨. gh는 `env -u GITHUB_TOKEN gh …`로 사용
- **GKE Autopilot**: kube-system 쓰기 불가 → kube-prometheus-stack의 kubelet/컨트롤플레인 모니터 비활성화; CRD는 ServerSideApply; loki-stack은 자체 grafana datasource(isDefault) 비활성화 필수
- **Cloud SQL**: GKE는 cloud-sql-proxy 사이드카 + `db.ts` 5회 재시도; Cloud Run은 `--add-cloudsql-instances`
- **인메모리 스토어**: 결제 챌린지·쿠팡 관측값은 재배포 시 소실 — 데모 전 `demo_market_pie_10cats.ts`로 재시딩
- **이미지 태그**: `:latest` 변경만으로는 ArgoCD가 롤링 안 함 → `kubectl rollout restart` 필요

## 🧬 온톨로지 규칙

- 온톨로지 소스는 `ontology/seondal-product.ofn` (ODK 규약, dated version IRI)
- 스키마 변경은 PR + (로드맵) ROBOT reasoner QC 통과 후
- A2A 간 원시 텍스트 전달 금지 (AGENT.md Rule 2.1) — 타입드 노드만

## 💳 결제 규칙

- MPP 표준 우선, 레거시 `X-Payment-*` 헤더 병행 유지 (무중단)
- devnet 우선, mock 샌드박스는 폴찌 — mainnet 금지 (데모)
- 결제 검증 3요소: 금액(잔액 변화) · 수신자 · 바인딩(Memo externalId 또는 reference 키)
- 퍼셋 429는 일상 — faucet 한도 있으면 사용자에게 보고 (빌더 지원 채널 있음)
