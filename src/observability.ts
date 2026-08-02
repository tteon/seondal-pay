/**
 * observability.ts — OpenTelemetry tracing + Prometheus metrics + structured logging
 *
 * IMPORT ORDER MATTERS: this module must be imported before any instrumented
 * module (express, http, pg, axios) so auto-instrumentation can patch them:
 *
 *   import 'dotenv/config';
 *   import './observability';
 *
 * - Traces: OTLP/HTTP → OTel Collector (OTEL_EXPORTER_OTLP_ENDPOINT, default http://localhost:4318)
 * - Metrics: prom-client registry, exposed via GET /metrics
 * - Logs: logEvent() emits one JSON line per event including trace_id/span_id
 *         so Grafana can correlate Loki logs ↔ Tempo traces.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';
import client from 'prom-client';

export const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'seondal-pay';
export const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const DEPLOY_ENV = process.env.DEPLOY_ENV || 'development';

// ---------------------------------------------------------------------------
// Tracing (OTLP → Collector → Tempo)
// ---------------------------------------------------------------------------
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    'deployment.environment': DEPLOY_ENV,
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // far too noisy
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
    }),
  ],
});

sdk.start();
process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});

export const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

// ---------------------------------------------------------------------------
// Structured logging (JSON line → Loki; trace ids → Tempo correlation)
// ---------------------------------------------------------------------------
export type LogLevel = 'info' | 'warn' | 'error';

export function logEvent(level: LogLevel, event: string, fields: Record<string, any> = {}) {
  const span = trace.getActiveSpan();
  const sc = span?.spanContext();
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    service: SERVICE_NAME,
    env: DEPLOY_ENV,
    trace_id: sc?.traceId,
    span_id: sc?.spanId,
    ...fields,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

// ---------------------------------------------------------------------------
// Prometheus metrics
// ---------------------------------------------------------------------------
export const metricsRegistry = new client.Registry();
metricsRegistry.setDefaultLabels({ service: SERVICE_NAME, env: DEPLOY_ENV });
client.collectDefaultMetrics({ register: metricsRegistry });

/** HTTP server latency by route */
export const httpRequestDuration = new client.Histogram({
  name: 'seondal_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.02, 0.05, 0.1, 0.3, 1, 3, 10],
  registers: [metricsRegistry],
});

/** 402 challenges issued */
export const paymentChallengesIssued = new client.Counter({
  name: 'seondal_payment_challenges_issued_total',
  help: 'HTTP 402 payment challenges issued',
  labelNames: ['tier'] as const,
  registers: [metricsRegistry],
});

/** Payment verification outcomes */
export const paymentVerifications = new client.Counter({
  name: 'seondal_payment_verifications_total',
  help: 'Payment verification outcomes',
  labelNames: ['protocol', 'result', 'reason'] as const,
  registers: [metricsRegistry],
});

/** Replay / double-spend rejections */
export const paymentReplayRejections = new client.Counter({
  name: 'seondal_payment_replay_rejections_total',
  help: 'Consumed-signature replay attempts rejected',
  labelNames: ['protocol'] as const,
  registers: [metricsRegistry],
});

/** Challenges rejected because the TTL expired */
export const paymentChallengeExpired = new client.Counter({
  name: 'seondal_payment_challenges_expired_total',
  help: 'Challenges rejected due to TTL expiry',
  registers: [metricsRegistry],
});

/** Currently open (unconsumed, unexpired) challenges */
export const activeChallengesGauge = new client.Gauge({
  name: 'seondal_payment_active_challenges',
  help: 'Open payment challenges awaiting settlement',
  registers: [metricsRegistry],
});

/** Verified payment revenue */
export const paymentRevenueSol = new client.Counter({
  name: 'seondal_payment_revenue_sol_total',
  help: 'Verified payment revenue in SOL',
  labelNames: ['tier'] as const,
  registers: [metricsRegistry],
});

/** Scraper outcomes + duration */
export const scrapeTotal = new client.Counter({
  name: 'seondal_scrape_total',
  help: 'Product scrape executions',
  labelNames: ['outcome'] as const, // ok | fallback | error
  registers: [metricsRegistry],
});

export const scrapeDuration = new client.Histogram({
  name: 'seondal_scrape_duration_seconds',
  help: 'Product scrape duration in seconds',
  labelNames: ['outcome'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

/** Database operations */
export const dbOperations = new client.Counter({
  name: 'seondal_db_operations_total',
  help: 'Database operations by backend and result',
  labelNames: ['operation', 'backend', 'result'] as const,
  registers: [metricsRegistry],
});

export const dbOperationDuration = new client.Histogram({
  name: 'seondal_db_operation_duration_seconds',
  help: 'Database operation duration in seconds',
  labelNames: ['operation', 'backend'] as const,
  buckets: [0.001, 0.005, 0.02, 0.1, 0.5, 2],
  registers: [metricsRegistry],
});

/** GCS (or mock storage) uploads */
export const gcsUploads = new client.Counter({
  name: 'seondal_gcs_uploads_total',
  help: 'Object storage uploads',
  labelNames: ['kind', 'backend', 'result'] as const,
  registers: [metricsRegistry],
});

/** Discord alert deliveries */
export const discordAlerts = new client.Counter({
  name: 'seondal_discord_alerts_total',
  help: 'Discord alert webhook deliveries',
  labelNames: ['kind', 'result'] as const,
  registers: [metricsRegistry],
});

/** Coupang ↔ 1688 comparator */
export const comparatorSweeps = new client.Counter({
  name: 'seondal_comparator_sweeps_total',
  help: 'Comparator sweeps over the product catalog',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export const comparatorMarginGauge = new client.Gauge({
  name: 'seondal_comparator_roi_percent',
  help: 'Latest computed ROI percent per product',
  labelNames: ['productId'] as const,
  registers: [metricsRegistry],
});

/** Interest-profile opportunity routing */
export const profileMatches = new client.Counter({
  name: 'seondal_profile_matches_total',
  help: 'Opportunities routed to interest profiles',
  labelNames: ['profile'] as const,
  registers: [metricsRegistry],
});

/** Coupang retail price observations ingested (OpenClaw/manual) */
export const coupangObservations = new client.Counter({
  name: 'seondal_coupang_observations_total',
  help: 'Coupang retail price observations ingested',
  labelNames: ['source'] as const,
  registers: [metricsRegistry],
});

/** Express middleware: measure every request */
export function httpMetricsMiddleware(req: any, res: any, next: any) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const route =
      (req.route?.path as string) ||
      (req.path.startsWith('/api') ? req.path : 'static');
    httpRequestDuration
      .labels(req.method, route, String(res.statusCode))
      .observe(durationSec);
  });
  next();
}

logEvent('info', 'observability.initialized', {
  otlpEndpoint,
  metricsEndpoint: '/metrics',
});
