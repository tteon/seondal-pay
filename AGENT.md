# 📜 SEONDAL // Intelligence System Rules (`AGENT.md`)

This document defines the foundational rules, brand identity, architectural constraints, and legal compliance principles for **SEONDAL // Intelligence**.

---

## 🎯 1. Core Corporate Mission & Identity

- **Brand Name**: **SEONDAL // Intelligence (선달 인텔리전스)**
- **Corporate Mission**: **`이커머스 정보 비대칭성 최소화를 위한 에이전트 도우미`** *(Agentic Assistant for Minimizing E-Commerce Information Asymmetry)*
- **Primary Slogan**: **`Clear Insights, Fair Commerce by SEONDAL`**
- **Brand Mascot**: Modern B2B AI Agent wearing a traditional Korean Gat (갓) hat holding a high-tech analytics tablet.
- **Brand Values**:
  - 🛡️ **Transparency (투명성)**: Eliminating hidden supply chain costs and false supplier claims.
  - 🔮 **Empowerment (임파워먼트)**: Empowering sellers across Early, Growth, and Mature stages.
  - ⚡ **Reliability (신뢰성)**: Delivering verified 1688 source factory intelligence.

---

## 🏛️ 2. Architectural Rules for Agent-to-Agent (A2A) Orchestration

### Rule 2.1: Ontology-Guided Information Noise Reduction
1. **Zero Raw Text Passing in A2A**: Agents MUST NOT pass unverified, noisy raw 1688/Taobao web text directly to other sub-agents.
2. **Mandatory Semantic Node Structuring**: All global supply chain data MUST be transformed into typed Knowledge Graph Nodes (`UserCircumstanceNode`, `ProductOntologyNode`, `TariffComplianceNode`) before sub-agent execution.
3. **Prevention of Cascade Error**: Filter out 99% of web text noise to ensure A2A reasoning accuracy remains >= 99.2%.

### Rule 2.2: Heterogeneous Multi-Model Role Division
- **Kimi 3.0 (Moonshot AI / Alibaba Ecosystem)**: Specialized Chinese B2B Ecosystem Classifier & 5 Tacit Quality Metrics Evaluator (Visual appeal, margin density, return risk, trend velocity, supplier trust rating).
- **DeepSeek 3.1**: Landed Cost Calculation & RCEP 0% Tariff Optimization Agent.
- **GPT-OSS 120B**: KC Safety Regulation & Origin Label Compliance Audit Agent.
- **MARA MiniMax**: High-Speed Commercial Logistics & Lead-time Synthesis.

---

## 🛍️ 3. User-First Web UI & Workflow Rules

### Rule 3.1: Clean UI & Internal Benchmark Isolation
- **User Dashboard Focus**: The public Web UI MUST focus 100% on **User Value** (Interactive Sourcing Reports List, 3 Visual Analytics Charts, KC Checklist, Naver SEO Keyword Pack, 4-Step Roadmap, 1688 Direct Outbound Buttons).
- **Benchmark API Isolation**: Internal developer benchmark matrices (`/api/benchmark/*`) MUST remain backend-only testing endpoints and MUST NOT clutter the end user's dashboard.

### Rule 3.2: Conversational AI to Saved Report Workflow
- In Tab 2 (`Conversational Intent AI Hub`), when the AI responds, it MUST offer a **`💾 Save to Reports List`** action.
- Saving a report MUST automatically attach hashtag badges (`#tags`), metadata, and push the report card into Tab 1 (`Saved Sourcing Reports List`).

---

## ⚖️ 4. Legal & Settlement Rules (pay.sh Solana Protocol)

### Rule 4.1: Zero-Custody Compliance (전자금융거래법 준수)
- The platform MUST NOT handle or hold Korean Won (KRW) fiat deposits/transfers to prevent PG registration liabilities (전자금융거래법 제28조) and unauthorized payment delegation risks (제18조).
- All machine-to-machine (M2M) information verification payments MUST use **pay.sh Solana HTTP 402 Payment Required protocol** for zero-custody, instant 400ms verification at 0.001 KRW transaction fee.

### Rule 4.2: MPP Standard Conformance (draft-solana-charge-00)
- The payment layer (`src/mppEngine.ts`) implements the **Machine Payments Protocol** Solana charge intent alongside the legacy `X-Payment-*` headers.
- **Challenge**: Every HTTP 402 response MUST carry a standard `WWW-Authenticate: Payment` header (JCS-canonicalized, base64url-encoded charge request) with `amount` in lamports, `currency: "sol"`, `recipient`, `externalId`, and an enforced `expires` TTL (default 300s, `MPP_CHALLENGE_TTL_SECONDS`).
- **Binding**: Payers MUST embed the challenge `externalId` as an on-chain **Memo instruction**; the verifier accepts either the Memo binding or the classic Solana Pay reference-key binding (backward compatibility).
- **Credential**: Payments are presented as `Authorization: Payment <base64url credential>` (push mode, `payload.type="signature"`).
- **Receipt**: Successful settlements MUST return a `Payment-Receipt` header (`{method, challengeId, reference=txSignature, status, timestamp}`).
- **Errors**: Payment failures MUST return HTTP 402 with RFC 9457 `application/problem+json` (`malformed-credential` / `invalid-challenge` / `verification-failed`) plus a fresh challenge.
- **Replay protection**: Consumed signatures and expired challenges are rejected globally; check-and-consume is atomic.
- E2E coverage: `scripts/test_mpp_flow.ts` (happy path, replay, tamper, expiry, legacy) and `scripts/test_memo_decode.ts` (devnet compiled-message memo decoding).
