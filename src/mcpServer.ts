/**
 * mcpServer.ts — Model Context Protocol server for SEONDAL Pay.
 *
 * Exposes the platform as MCP tools over HTTP (JSON-RPC 2.0, Streamable
 * HTTP style at POST /mcp) so Claude / any MCP client can call our engines.
 *
 * The twist that makes it the agent micro-economy: PAID tools are gated by
 * our MPP/Solana layer. Flow for a paying agent:
 *
 *   1. tools/call get_payment_challenge {tier}     → MPP 402-style challenge
 *   2. agent pays on Solana devnet (transfer + Memo(externalId))
 *   3. tools/call get_sourcing_analysis {query, paymentSignature}
 *      → server verifies on-chain (amount, recipient, memo binding,
 *        replay, TTL) and returns the tool result.
 *
 * Free tools: get_market_pie, get_comparator_leaderboard, get_product_catalog,
 *             get_wallet_balance, get_profiles.
 * Paid tools: get_payment_challenge (free), get_sourcing_analysis (Tier 3),
 *             scrape_product (Tier 3, /api/scrape와 동일 검증 경로).
 */
import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { issueChallenge, getChallenge, consumeChallenge, activeChallengeCount } from './mppEngine';
import { computeMarketPie } from './marketPieEngine';
import { getLatestSnapshots } from './comparatorEngine';
import { queryProducts } from './db';
import { listProfiles } from './interestProfileEngine';
import { runLiveSourcingPipeline } from './liveSourcingPipeline';
import { assessProductCompliance } from './complianceVerdictEngine';
import { logEvent } from './observability';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'seondal-pay', version: '1.0.0' };

const TIER_PRICES: Record<number, number> = { 1: 0.005, 2: 0.015, 3: 0.05 };

const TOOLS = [
  {
    name: 'get_market_pie',
    description: '쿠팡 카테고리/키워드 그룹의 마켓 파이 (TOP5 판매자의 월간 판매 점유율, 가격 분포). 묣료.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string', description: '그룹 키워드 (예: 롬퍼, 수유등, 요가매트)' } },
      required: ['group'],
    },
  },
  {
    name: 'get_comparator_leaderboard',
    description: '쿠팡↔1688 마진 분석 리더보드 (랜디드코스트 vs 실측 소매가, 수수료 후 순마진/ROI). 묣료.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_product_catalog',
    description: 'Cloud SQL에 적재된 상품 카탈로그 (JSON-LD 온톨로지 노드 포함). 묣료.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_wallet_balance',
    description: 'Solana devnet 지갑 잔액 조회 (결제 전 잔액 확인용). 묣료.',
    inputSchema: {
      type: 'object',
      properties: { address: { type: 'string', description: 'base58 지갑 주소 (기본: merchant)' } },
    },
  },
  {
    name: 'get_profiles',
    description: 'SEONDAL 관심 프로파일 목록 (ROI 밴드·마진·리스크 성향). 묣료.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'assess_compliance',
    description: '상품명(중/한/영 혼합 가능)의 한국 규제 적합성 판정 — 어린이제품법/전파법/전안법/식품위생법/리튬 운송/원산지. 기관 라우팅, 예상 비용·기간, 🟢🟡🔴 판정. 결정론적 룰 엔진(LLM 환각 없음). 묣료.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '상품명 (예: 儿童硅胶餐具套装 or 유아 LED 칫솔)' },
        extraText: { type: 'string', description: '추가 스펙 텍스트 (선택)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_payment_challenge',
    description: '유료 도구 사용을 위한 MPP 결제 챌린지 발행 (Solana). 챌린지의 externalId를 Memo로 포함한 전송 후 서명을 결제 증명으로 사용.',
    inputSchema: {
      type: 'object',
      properties: { tier: { type: 'number', enum: [1, 2, 3], description: '1=0.005, 2=0.015, 3=0.05 SOL' } },
      required: ['tier'],
    },
  },
  {
    name: 'get_sourcing_analysis',
    description: '[Tier 3 유료] 라이브 소싱 파이프라인 전체 실행 (카탈로그 스캔→MPP 챌린지→온톨로지 타이핑→쿠팡 판매자 추정 경제→프로파일 라우팅→리포트). paymentSignature 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '소싱 질의 (예: 유아 롬퍼)' },
        paymentSignature: { type: 'string', description: 'get_payment_challenge로 발급받은 챌린지에 대한 Solana 결제 서명' },
      },
      required: ['query', 'paymentSignature'],
    },
  },
];

// verifyPayment is injected from server.ts to share the exact verification path
type VerifyFn = (
  signature: string,
  recipient: PublicKey,
  amountSol: number,
  binding: { legacyReference?: PublicKey; externalId?: string }
) => Promise<boolean>;

export function createMcpHandler(opts: {
  merchantPublicKey: PublicKey;
  verifyPayment: VerifyFn;
  getDevnetBalance: (address: string) => Promise<number>;
}) {
  const { merchantPublicKey, verifyPayment, getDevnetBalance } = opts;
  const consumedSignatures = new Set<string>();
  // MCP-issued challenges awaiting payment, keyed by challenge id
  const mcpChallenges = new Map<string, ReturnType<typeof issueChallenge>>();

  function result(id: any, value: any) {
    return { jsonrpc: '2.0', id, result: value };
  }
  function rpcError(id: any, code: number, message: string, data?: any) {
    return { jsonrpc: '2.0', id, error: { code, message, data } };
  }
  function toolText(value: any) {
    return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
  }

  async function callTool(name: string, args: any): Promise<{ ok: boolean; value: any; isError?: boolean }> {
    switch (name) {
      case 'get_market_pie':
        return { ok: true, value: computeMarketPie(String(args?.group || '유아복')) };

      case 'get_comparator_leaderboard':
        return { ok: true, value: { leaderboard: getLatestSnapshots() } };

      case 'get_product_catalog': {
        const products = await queryProducts();
        return { ok: true, value: { count: products.length, products } };
      }

      case 'get_wallet_balance': {
        const address = args?.address || merchantPublicKey.toBase58();
        try {
          const sol = await getDevnetBalance(address);
          return { ok: true, value: { address, balanceSol: sol, network: 'devnet' } };
        } catch (e: any) {
          return { ok: false, value: `devnet 조회 실패: ${e.message}`, isError: true };
        }
      }

      case 'get_profiles':
        return { ok: true, value: { profiles: listProfiles() } };

      case 'assess_compliance': {
        if (!args?.title) return { ok: false, value: 'title이 필요합니다', isError: true };
        return { ok: true, value: assessProductCompliance(String(args.title), String(args.extraText || '')) };
      }

      case 'get_payment_challenge': {
        const tier = args?.tier ? parseInt(args.tier) : 3;
        const amountSol = TIER_PRICES[tier] || 0.05;
        const challenge = issueChallenge({
          id: `MCP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          recipient: merchantPublicKey.toBase58(),
          tier,
          amountSol,
          realm: 'seondal-mcp',
          description: `MCP tool access Tier ${tier}`,
        });
        logEvent('info', 'mcp.challenge_issued', { tier, amountSol, challengeId: challenge.id });
        mcpChallenges.set(challenge.id, challenge);
        return {
          ok: true,
          value: {
            instructions: '이 챌린지의 recipient로 amountSol을 externalId를 Memo instruction에 넣어 전송하고, 트랜잭션 서명을 paymentSignature로 사용하세요.',
            challengeId: challenge.id,
            recipient: challenge.chargeRequest.recipient,
            amountSol,
            amountLamports: challenge.chargeRequest.amount,
            externalId: challenge.chargeRequest.externalId,
            expires: challenge.expires,
            network: 'devnet',
          },
        };
      }

      case 'get_sourcing_analysis': {
        const { query, paymentSignature } = args || {};
        if (!query || !paymentSignature) {
          return { ok: false, value: 'query와 paymentSignature가 필요합니다 (get_payment_challenge 먼저 호출)', isError: true };
        }
        // Try every unconsumed MCP challenge: the signature pays the one whose
        // amount + externalId(memo) matches on-chain.
        const sig = String(paymentSignature);
        if (consumedSignatures.has(sig)) {
          return { ok: false, value: '이 서명은 이미 사용되었습니다 (replay 차단)', isError: true };
        }
        let paid = false;
        let usedChallenge: ReturnType<typeof issueChallenge> | null = null;
        for (const [id, ch] of mcpChallenges) {
          if (Date.now() > ch.expiresAtMs) { mcpChallenges.delete(id); continue; }
          const ok = await verifyPayment(sig, merchantPublicKey, ch.amountSol, {
            externalId: ch.chargeRequest.externalId,
          });
          if (ok) {
            paid = true;
            usedChallenge = ch;
            consumedSignatures.add(sig);
            consumeChallenge(id);
            mcpChallenges.delete(id);
            break;
          }
        }
        if (!paid) {
          return {
            ok: false,
            value: {
              error: '결제 검증 실패 — get_payment_challenge로 새 챌린지를 발급받고, externalId를 Memo에 넣어 정확한 금액을 전송했는지 확인하세요.',
              hint: '활성 챌린지 수: ' + activeChallengeCount(),
            },
            isError: true,
          };
        }
        logEvent('info', 'mcp.tool_paid_call', { tool: name, query, challengeId: usedChallenge?.id, signature: sig });
        const pipeline = await runLiveSourcingPipeline(String(query), usedChallenge?.tier || 3);
        return { ok: true, value: pipeline };
      }

      default:
        return { ok: false, value: `알 수 없는 도구: ${name}`, isError: true };
    }
  }

  return async function mcpHandler(req: Request, res: Response) {
    const body = req.body || {};
    const { jsonrpc, id, method, params } = body;
    if (jsonrpc !== '2.0') {
      return res.status(400).json(rpcError(id ?? null, -32600, 'JSON-RPC 2.0 required'));
    }
    switch (method) {
      case 'initialize':
        return res.json(result(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        }));

      case 'notifications/initialized':
      case 'initialized':
        return res.status(202).end();

      case 'tools/list':
        return res.json(result(id, { tools: TOOLS }));

      case 'tools/call': {
        const { name, arguments: toolArgs } = params || {};
        try {
          const r = await callTool(String(name), toolArgs || {});
          const payload = toolText(r.value);
          return res.json(result(id, r.isError ? { ...payload, isError: true } : payload));
        } catch (e: any) {
          return res.json(rpcError(id, -32000, e.message));
        }
      }

      case 'ping':
        return res.json(result(id, {}));

      default:
        return res.json(rpcError(id, -32601, `method not found: ${method}`));
    }
  };
}
