# Ontology Lifecycle (ODK)

이 디렉토리는 [INCATools ODK](https://github.com/INCATools/ontology-development-kit) 규약으로 관리되는
SEONDAL 소싱 온톨로지의 **소스 오브 트루스**입니다.

## 왜 ODK인가 — ontology versioning

- **온톨로지도 코드다**: 런타임(TS 엔진)이 소비하는 타입드 노드의 스키마를 Git에서 버전관리
- **버전 IRI**: `…/seondal-product/2026-08-02` 형태의 dated release + `owl:versionInfo`
- **QC**: ROBOT reasoner로 릴리스 전 일관성 검증 (CI, `ontology/.github/workflows/qc.yml` — 로드맵)
- **릴리스 아티팩트**: OWL(Functional Syntax 소스) → JSON-LD export → 런타임(`ontologyMining.ts`, `productOntologyGraph.ts`)이 소비

## 현재 소스

- `seondal-product.ofn` — two modules:
  - **M1 Core** — schema.org 정합 클래스: `Product`, `ProductOntologyNode`,
    `UserCircumstanceNode`, `TariffComplianceNode`, `InterestProfile`, `MarginSnapshot`
    + taxonomy enrichment 관계(`isTypeOf` hypernym, `sameAsSynonym`)
  - **M2 China-Sourcing Extension** — **schema.org에 없는 중국 소싱 고유 개념**,
    각 항목에 문제 정의(왜 존재해야 하는가)를 annotation으로 내장:
    | 개념 | schema.org에 없는 이유 |
    |---|---|
    | `SupplierTrustProfile` (诚信通연수, 实力商家, 공장실사) | 같은 리스팅도 공장 신뢰도가 사기 리스크 #1 요인 — Organization으로 표현 불가 |
    | `MoqPriceTier` (수량 구간 도매가 사다리) | 1688 가격은 본질적으로 tiered — 단일 priceSpecification으로 마진 계산 불가 |
    | `RcepTariffPreference` (Form E 0% 특혜) | 관세 8%↔0%는 상품이 아니라 공급처 CO 발급 가능성이 결정 |
    | `TacitQualityMetrics` (썸네일 어필·마진 밀도·반품 리스크·트렌드 속도) | 구매 결정은 암묵 신호로 이뤄지는데 어떤 공개 스키마에도 없음 (AGENT.md Rule 2.2의 5지표) |
    | `TrendSignal` (Baidu 지수·Douyin 속도, 출처+시각) | "Douyin에서 뜬다"는 리포트 문장이 아니라 쿼리 가능한 사실이어야 함 |
    | `supportsDropshipping`/`supportsMixedBatch` (一件代发·混批) | 초기 셀러의 무재고 생존 조건 — fulfillment capability를 표현하는 스키마 부재 |

## 라이프사이클 (GitOps와 동일 철학)

```
ontology/*.ofn  ──PR──▶  ROBOT reason QC (CI)  ──merge──▶  release (tagged)
                                                              │
                                        ┌─────────────────────┘
                                        ▼
                          runtime JSON-LD export → ArgoCD sync
```

편집 → 검증 → 배포가 선언적이라는 점에서 인프라(ArgoCD)와 동일한 라이프사이클을 따릅니다.
