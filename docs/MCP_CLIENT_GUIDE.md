# 🔌 SEONDAL Pay MCP — 클라이언트 연결 가이드

> 우리 플랫폼이 MCP 서버입니다. Claude(데스크톱/CLI), Cline, OpenClaw 등
> MCP 클라이언트가 우리 도구를 호출하고, 유료 도구는 Solana로 결제합니다.

## 엔드포인트

```
POST https://seondal-pay-1064390008895.us-central1.run.app/mcp
Transport: streamable-http (JSON-RPC 2.0)
```

## Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "seondal-pay": {
      "type": "streamable-http",
      "url": "https://seondal-pay-1064390008895.us-central1.run.app/mcp"
    }
  }
}
```

## Claude Code (CLI)

```bash
claude mcp add --transport http seondal-pay \
  https://seondal-pay-1064390008895.us-central1.run.app/mcp
```

## 도구 목록 (8개)

| 도구 | 과금 | 설명 |
|---|---|---|
| `get_market_pie` | 묣료 | 카테고리 마켓 파이 (TOP5 판매 점유율·가격 분포) |
| `get_comparator_leaderboard` | 묣료 | 쿠팡↔1688 마진 리더보드 |
| `get_product_catalog` | 묣료 | Cloud SQL 상품 카탈로그 |
| `get_wallet_balance` | 묣료 | devnet 지갑 잔액 (결제 전 확인) |
| `get_profiles` | 묣료 | 관심 프로파일 목록 |
| `assess_compliance` | 묣료 | 결정론적 규제 판정 (KC/전파/전안법/식약처) |
| `get_payment_challenge` | 묣료 | 유료 도구용 MPP 챌린지 발행 |
| `get_sourcing_analysis` | **Tier 3 (0.05 SOL)** | 라이브 소싱 파이프라인 전체 실행 |

## 유료 도구 사용 흐름 (에이전트가 따라야 할 절차)

```
1. tools/call get_payment_challenge { tier: 3 }
   → { recipient, amountSol, externalId, expires, challengeId }
2. Solana devnet에서 recipient로 amountSol 전송
   + Memo instruction에 externalId 포함
3. tools/call get_sourcing_analysis { query, paymentSignature }
   → 서버가 온체인 검증(금액·수신자·메모·TTL·리플레이) 후 결과 반환
```

- 챌린지 TTL: 300초 (만료 시 새 챌린지로 재시도)
- 서명 재사용 불가 (replay 차단)
- 결제 증명: solscan에서 tx 조회 가능 (devnet)

## 검증 스크립트

```bash
# 로컬 서버 대상 전체 플로우 (init→도구→챌린지→결제→해금→리플레이)
PORT=3000 npx ts-node src/server.ts &
npx ts-node scripts/test_mcp_flow.ts
```
