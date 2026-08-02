/**
 * alertRuleEngine.ts — User-defined alert rules (pushed to Discord).
 *
 * Users don't live on the dashboard. Rules evaluate on two events:
 *   - comparator sweep completed (margin/ROI landscape changed)
 *   - new product upserted (fresh opportunity appeared)
 *
 * Trigger types:
 *   roi_above        — any product's ROI ≥ threshold (optionally in category)
 *   margin_above     — any product's marginKrw ≥ threshold
 *   new_product      — any new product enters the catalog (optionally ROI-gated)
 *   portfolio_drift  — my portfolio's expected ROI drops below threshold
 *   price_drop       — a product's landed cost fell vs its previous snapshot
 */
import { getLatestSnapshots, getMarginCurve, PriceSnapshot } from './comparatorEngine';
import { logEvent, discordAlerts as discordAlertMetric } from './observability';
import { classifyTitle } from './categoryCatalog';

export type AlertTrigger = 'roi_above' | 'margin_above' | 'new_product' | 'portfolio_drift' | 'price_drop';

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  trigger: AlertTrigger;
  params: {
    roiMin?: number;
    marginMinKrw?: number;
    category?: string;
    portfolioRoiMin?: number;
  };
  enabled: boolean;
  createdAt: string;
  lastFiredAt?: string;
  fireCount: number;
}

export interface AlertFire {
  ruleId: string;
  ruleName: string;
  firedAt: string;
  title: string;
  description: string;
  payload: any;
}

const COOLDOWN_MS = 30 * 60 * 1000; // same rule can't refire within 30 min

// In-memory demo stores
const rules = new Map<string, AlertRule>();
const fireHistory: AlertFire[] = [];
const knownProductIds = new Set<string>();

export function listRules(userId?: string): AlertRule[] {
  const all = [...rules.values()];
  return userId ? all.filter((r) => r.userId === userId) : all;
}

export function getFireHistory(limit = 20): AlertFire[] {
  return fireHistory.slice(-limit).reverse();
}

export function upsertRule(input: Partial<AlertRule> & { id?: string; userId?: string }): AlertRule | null {
  const existing = input.id ? rules.get(input.id) : undefined;
  if (input.id && !existing && !input.trigger) return null; // can't create without trigger
  const id = input.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const rule: AlertRule = {
    id,
    userId: input.userId || existing?.userId || 'demo-user',
    name: input.name || existing?.name || `${input.trigger || existing?.trigger} rule`,
    trigger: (input.trigger || existing?.trigger)!,
    params: input.params || existing?.params || {},
    enabled: input.enabled !== undefined ? input.enabled : (existing?.enabled ?? true),
    createdAt: existing?.createdAt || new Date().toISOString(),
    lastFiredAt: existing?.lastFiredAt,
    fireCount: existing?.fireCount || 0,
  };
  rules.set(id, rule);
  logEvent('info', 'alert.rule_upserted', { ruleId: id, trigger: rule.trigger, userId: rule.userId });
  return rule;
}

export function deleteRule(id: string): boolean {
  return rules.delete(id);
}

function canFire(rule: AlertRule): boolean {
  if (!rule.enabled) return false;
  if (!rule.lastFiredAt) return true;
  return Date.now() - new Date(rule.lastFiredAt).getTime() > COOLDOWN_MS;
}

function recordFire(rule: AlertRule, title: string, description: string, payload: any): AlertFire {
  rule.lastFiredAt = new Date().toISOString();
  rule.fireCount++;
  const fire: AlertFire = { ruleId: rule.id, ruleName: rule.name, firedAt: rule.lastFiredAt, title, description, payload };
  fireHistory.push(fire);
  logEvent('info', 'alert.rule_fired', { ruleId: rule.id, trigger: rule.trigger, title });
  return fire;
}

function categoryMatches(ruleCategory: string | undefined, title: string): boolean {
  if (!ruleCategory) return true;
  const meta = classifyTitle(title);
  return meta?.name === ruleCategory || ruleCategory === '기타';
}

/** Evaluate all rules against the current snapshot landscape. Returns fires. */
export function evaluateRules(event: 'sweep' | 'new_product', newProductId?: string): AlertFire[] {
  const fires: AlertFire[] = [];
  const snapshots = getLatestSnapshots();

  for (const rule of rules.values()) {
    if (!canFire(rule)) continue;

    switch (rule.trigger) {
      case 'roi_above': {
        const hit = snapshots.find((s) =>
          s.roiPercent >= (rule.params.roiMin ?? 40) && categoryMatches(rule.params.category, s.title)
        );
        if (hit) {
          fires.push(recordFire(rule,
            `🔥 ROI ${hit.roiPercent}% 상품 감지`,
            `'${hit.title.slice(0, 50)}' — 기준 ${rule.params.roiMin}% 초과${rule.params.category ? ` (${rule.params.category})` : ''}. 예상 마진 ₩${hit.marginKrw.toLocaleString()}`,
            hit));
        }
        break;
      }
      case 'margin_above': {
        const hit = snapshots.find((s) =>
          s.marginKrw >= (rule.params.marginMinKrw ?? 10000) && categoryMatches(rule.params.category, s.title)
        );
        if (hit) {
          fires.push(recordFire(rule,
            `💰 고마진 상품 감지 (₩${hit.marginKrw.toLocaleString()})`,
            `'${hit.title.slice(0, 50)}' — 마진 기준 ₩${(rule.params.marginMinKrw ?? 10000).toLocaleString()} 초과 (ROI ${hit.roiPercent}%)`,
            hit));
        }
        break;
      }
      case 'new_product': {
        if (event === 'new_product' && newProductId) {
          const snap = snapshots.find((s) => s.productId === newProductId);
          const roiOk = !rule.params.roiMin || (snap && snap.roiPercent >= rule.params.roiMin);
          if (snap && roiOk && !knownProductIds.has(newProductId)) {
            fires.push(recordFire(rule,
              `🆕 신규 상품 등록: ROI ${snap.roiPercent}%`,
              `'${snap.title.slice(0, 50)}' — 카탈로그 신규 진입, ROI ${snap.roiPercent}%${rule.params.roiMin ? ` (기준 ${rule.params.roiMin}% 통과)` : ''}`,
              snap));
          }
        }
        break;
      }
      case 'portfolio_drift': {
        if (snapshots.length === 0) break;
        const avgRoi = snapshots.reduce((a, s) => a + s.roiPercent, 0) / snapshots.length;
        const threshold = rule.params.portfolioRoiMin ?? 25;
        if (avgRoi < threshold) {
          fires.push(recordFire(rule,
            `📉 포트폴리오 기대 ROI 하락 (${avgRoi.toFixed(1)}%)`,
            `카탈로그 평균 ROI가 기준 ${threshold}% 아래로 낙하 — 시장 상황 점검 필요`,
            { avgRoi, threshold }));
        }
        break;
      }
      case 'price_drop': {
        const dropped = snapshots.find((s) => {
          const curve = getMarginCurve(s.productId);
          if (curve.length < 2) return false;
          return curve[0].landedCostKrw < curve[1].landedCostKrw && categoryMatches(rule.params.category, s.title);
        });
        if (dropped) {
          fires.push(recordFire(rule,
            `📦 원가 하락 감지: ${dropped.title.slice(0, 40)}`,
            `랜디드코스트 ₩${dropped.landedCostKrw.toLocaleString()}로 하락 — 재고 확보 타이밍`,
            dropped));
        }
        break;
      }
    }
  }

  // Track known products for new_product rules
  for (const s of snapshots) knownProductIds.add(s.productId);
  if (newProductId) knownProductIds.add(newProductId);

  return fires;
}
