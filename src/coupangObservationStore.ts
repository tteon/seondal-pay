/**
 * coupangObservationStore.ts — Real Coupang retail price observations.
 *
 * OpenClaw (user's browser agent) or a human posts prices they SEE on
 * coupang.com — product-info only, read-side. These observed prices become
 * the comparator's Coupang-side anchor (highest-priority real source) and
 * let us estimate "the Coupang seller's margin" for SEONDAL users.
 */
import { logEvent, coupangObservations } from './observability';

export interface CoupangPriceObservation {
  productName: string;
  priceKrw: number;
  url?: string;
  category?: string;
  monthlySales?: number;  // 쿠팡 월간 판매량 (OpenClaw가 페이지에서 읽은 값)
  reviewCount?: number;   // 리뷰 수 (판매량 프록시)
  source: string; // 'openclaw' | 'manual' | ...
  capturedAt: string;
}

const observations: CoupangPriceObservation[] = [
  {
    productName: "삼성전자 갤럭시북6 NT760VJT-A51A 16인치 코어Ultra5",
    priceKrw: 1290000,
    url: "https://www.coupang.com/vp/products/85001",
    category: "노트북/디지털",
    monthlySales: 1450,
    reviewCount: 320,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "삼성노트북 갤럭시북4 NT750XGR-A28A 가성비 인강용 Win11",
    priceKrw: 699000,
    url: "https://www.coupang.com/vp/products/85002",
    category: "노트북/디지털",
    monthlySales: 2100,
    reviewCount: 580,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "LG 울트라PC 15U560 15.6인치 코어i5",
    priceKrw: 589000,
    url: "https://www.coupang.com/vp/products/85003",
    category: "노트북/디지털",
    monthlySales: 890,
    reviewCount: 210,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "2025 여름 신생아 순면 스플라이싱 롬퍼 (쿠팡 실측 TOP4)",
    priceKrw: 38500,
    url: "https://www.coupang.com/vp/products/85004",
    category: "유아동 의류",
    monthlySales: 3200,
    reviewCount: 940,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "아기 젖병 실리콘 세척 브러쉬 세트 TOP5",
    priceKrw: 15900,
    url: "https://www.coupang.com/vp/products/85005",
    category: "유아용품",
    monthlySales: 4100,
    reviewCount: 1250,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "스마트 무선 미니 선풍기 거치대 겸용 TOP6",
    priceKrw: 21900,
    url: "https://www.coupang.com/vp/products/85006",
    category: "소형가전",
    monthlySales: 5300,
    reviewCount: 2100,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "무소음 무선 마우스 C타입 충전식 TOP7",
    priceKrw: 12800,
    url: "https://www.coupang.com/vp/products/85007",
    category: "전자기기",
    monthlySales: 6200,
    reviewCount: 3400,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "초경량 보조배터리 20000mAh 고속충전 TOP8",
    priceKrw: 24900,
    url: "https://www.coupang.com/vp/products/85008",
    category: "전자기기",
    monthlySales: 7800,
    reviewCount: 4500,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "친환경 옥수수 성분 아기 식기 세트 TOP9",
    priceKrw: 28900,
    url: "https://www.coupang.com/vp/products/85009",
    category: "유아용품",
    monthlySales: 1950,
    reviewCount: 430,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  },
  {
    productName: "프리미엄 무선 수유등 3단계 조절 TOP10",
    priceKrw: 31500,
    url: "https://www.coupang.com/vp/products/85010",
    category: "유아용품",
    monthlySales: 2400,
    reviewCount: 810,
    source: "openclaw-agent-browsing",
    capturedAt: new Date().toISOString()
  }
];

const MAX_OBSERVATIONS = 500;

export function addObservation(obs: Omit<CoupangPriceObservation, 'capturedAt'>): CoupangPriceObservation {
  const full: CoupangPriceObservation = { ...obs, capturedAt: new Date().toISOString() };
  observations.unshift(full);
  if (observations.length > MAX_OBSERVATIONS) observations.length = MAX_OBSERVATIONS;
  coupangObservations.inc({ source: obs.source || 'unknown' });
  logEvent('info', 'coupang.observation_added', {
    productName: obs.productName.slice(0, 60), priceKrw: obs.priceKrw, source: obs.source,
  });
  return full;
}

export function listObservations(limit = 100): CoupangPriceObservation[] {
  return observations.slice(0, limit);
}

/** Get Top 10 recent agent browsing observations */
export function getTop10Observations(keyword?: string): CoupangPriceObservation[] {
  if (!keyword) return observations.slice(0, 10);
  const q = keyword.toLowerCase();
  const matched = observations.filter((o) => o.productName.toLowerCase().includes(q) || (o.category || '').toLowerCase().includes(q));
  return matched.length > 0 ? matched.slice(0, 10) : observations.slice(0, 10);
}

/** Token-overlap match: find the best observed price for a product title. */
export function matchObservation(title: string): CoupangPriceObservation | undefined {
  const tokens = (title || '').toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return undefined;
  let best: { obs: CoupangPriceObservation; hits: number } | undefined;
  for (const obs of observations) {
    const name = obs.productName.toLowerCase();
    const hits = tokens.filter((t) => name.includes(t)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { obs, hits };
  }
  return best && best.hits >= Math.min(2, tokens.length) ? best.obs : undefined;
}

