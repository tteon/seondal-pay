/**
 * discordAlerter.ts — Business-event alerts → Discord
 *
 * Two audiences read the same channel:
 *   1. Humans (evaluators) — rich embeds for payment/sourcing events
 *   2. OpenClaw (the user's personal agent on Discord) — a structured
 *      "handoff payload" block it can parse to act on (e.g. Coupang listing)
 *
 * No-op when DISCORD_WEBHOOK_URL is unset (local dev default).
 */
import axios from 'axios';
import { trace } from '@opentelemetry/api';
import { logEvent, discordAlerts } from './observability';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const ROI_ALERT_MIN_PERCENT = parseFloat(process.env.ROI_ALERT_MIN_PERCENT || '40');

export function isDiscordEnabled(): boolean {
  return WEBHOOK_URL.length > 0;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

async function postToDiscord(embed: DiscordEmbed, kind: string): Promise<void> {
  if (!isDiscordEnabled()) return;
  try {
    await axios.post(
      WEBHOOK_URL,
      { username: 'SEONDAL // Intelligence', embeds: [embed] },
      { timeout: 5000 }
    );
    discordAlerts.inc({ kind, result: 'ok' });
  } catch (err: any) {
    discordAlerts.inc({ kind, result: 'error' });
    logEvent('error', 'discord.alert_failed', { kind, error: err.message });
  }
}

export interface SourcingAlertInput {
  productId: string;
  title: string;
  priceUsd: number;
  koreanBenchmarkPriceKrw?: number;
  roiMarginPercent?: number;
  tier: number;
  amountSol: number;
  signature: string;
  paymentMode: string; // 'mock' | 'devnet'
  traceId?: string;
  /** Interest profiles this opportunity was routed to (if any) */
  matchedProfiles?: { displayName: string; score: number }[];
}

/** Parse the scraper's JSON-LD enrichment into alert inputs. */
export function extractRoiSignals(dataJsonLd: any): {
  koreanBenchmarkPriceKrw?: number;
  roiMarginPercent?: number;
} {
  const props: any[] = dataJsonLd?.additionalProperty || [];
  const priceProp = props.find((p) => p.name === 'Korean Benchmark Retail Price');
  const roiProp = props.find((p) => p.name === 'Estimated ROI Margin');
  return {
    koreanBenchmarkPriceKrw: priceProp ? Number(priceProp.value) : undefined,
    roiMarginPercent: roiProp ? parseFloat(String(roiProp.value).replace('%', '')) : undefined,
  };
}

/**
 * Fire a high-ROI sourcing alert after a verified payment + scrape.
 * Returns true if the product met the alert threshold (regardless of
 * whether Discord delivery is enabled).
 */
export async function alertHighValueSourcing(input: SourcingAlertInput): Promise<boolean> {
  const roi = input.roiMarginPercent ?? 0;
  const profileMatched = (input.matchedProfiles?.length ?? 0) > 0;
  // Alert when the global ROI bar clears OR any interest profile claimed it
  if (roi < ROI_ALERT_MIN_PERCENT && !profileMatched) return false;

  const traceId = input.traceId || trace.getActiveSpan()?.spanContext().traceId;

  const handoffPayload = {
    action: 'coupang_listing_candidate',
    productId: input.productId,
    sourceUrl: `${PUBLIC_BASE_URL}/products/${input.productId}/source.html`,
    api: {
      product: `${PUBLIC_BASE_URL}/api/products`,
      reserveOrder: `${PUBLIC_BASE_URL}/api/orders/reserve`,
    },
    wholesalePriceUsd: input.priceUsd,
    koreanBenchmarkPriceKrw: input.koreanBenchmarkPriceKrw,
    estimatedRoiPercent: roi,
    paymentProof: input.signature,
  };

  logEvent('info', 'alert.high_value_sourcing', {
    productId: input.productId,
    roiPercent: roi,
    threshold: ROI_ALERT_MIN_PERCENT,
  });

  await postToDiscord(
    {
      title: '🔥 고ROI 소싱 기회 감지 — OpenClaw Handoff',
      color: 0xf59e0b,
      description:
        `에이전트가 Tier ${input.tier} 데이터를 결제하고 검증한 결과, ` +
        `기준치(${ROI_ALERT_MIN_PERCENT}%)를 넘는 ROI가 확인되었습니다.`,
      fields: [
        { name: '상품', value: input.title.slice(0, 200), inline: false },
        { name: '도매가', value: `$${input.priceUsd.toFixed(2)}`, inline: true },
        {
          name: '한국 벤치마크가',
          value: input.koreanBenchmarkPriceKrw
            ? `${input.koreanBenchmarkPriceKrw.toLocaleString()} KRW`
            : 'N/A',
          inline: true,
        },
        { name: '예상 ROI', value: `${roi.toFixed(1)}%`, inline: true },
        { name: '결제', value: `${input.amountSol} SOL (${input.paymentMode})`, inline: true },
        {
          name: '결제 증명',
          value: `[solscan](https://solscan.io/tx/${input.signature}?cluster=devnet)`,
          inline: true,
        },
        ...(profileMatched
          ? [{
              name: '🎯 매칭된 관심 프로파일',
              value: input.matchedProfiles!
                .map((p) => `**${p.displayName}** (score ${p.score})`)
                .join('\n'),
              inline: false,
            }]
          : []),
        {
          name: '🤖 OpenClaw Handoff Payload',
          value: '```json\n' + JSON.stringify(handoffPayload, null, 2) + '\n```',
          inline: false,
        },
      ],
      footer: { text: `seondal-pay · trace ${traceId || 'n/a'}` },
      timestamp: new Date().toISOString(),
    },
    'high_value_sourcing'
  );
  return true;
}

/** Infra-style freeform alert (used for non-scrape business events). */
export async function alertSystemEvent(
  title: string,
  description: string,
  severity: 'info' | 'warn' | 'critical' = 'info'
): Promise<void> {
  const colors = { info: 0x3b82f6, warn: 0xf59e0b, critical: 0xef4444 };
  await postToDiscord(
    { title, description, color: colors[severity], timestamp: new Date().toISOString() },
    'system_event'
  );
}
