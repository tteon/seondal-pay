# Ontology Lifecycle (ODK)

이 디렉토리는 [INCATools ODK](https://github.com/INCATools/ontology-development-kit) 규약으로 관리되는
SEONDAL 소싱 온톨로지의 **소스 오브 트루스**입니다.

## 왜 ODK인가 — ontology versioning

- **온톨로지도 코드다**: 런타임(TS 엔진)이 소비하는 타입드 노드의 스키마를 Git에서 버전관리
- **버전 IRI**: `…/seondal-product/2026-08-02` 형태의 dated release + `owl:versionInfo`
- **QC**: ROBOT reasoner로 릴리스 전 일관성 검증 (CI, `ontology/.github/workflows/qc.yml` — 로드맵)
- **릴리스 아티팩트**: OWL(Functional Syntax 소스) → JSON-LD export → 런타임(`ontologyMining.ts`, `productOntologyGraph.ts`)이 소비

## 현재 소스

- `seondal-product.ofn` — 코어 클래스: `Product`(schema.org 정합), `ProductOntologyNode`,
  `UserCircumstanceNode`, `TariffComplianceNode`, `InterestProfile`, `MarginSnapshot`
  + taxonomy enrichment 관계(`isTypeOf` hypernym, `sameAsSynonym`)

## 라이프사이클 (GitOps와 동일 철학)

```
ontology/*.ofn  ──PR──▶  ROBOT reason QC (CI)  ──merge──▶  release (tagged)
                                                              │
                                        ┌─────────────────────┘
                                        ▼
                          runtime JSON-LD export → ArgoCD sync
```

편집 → 검증 → 배포가 선언적이라는 점에서 인프라(ArgoCD)와 동일한 라이프사이클을 따릅니다.
