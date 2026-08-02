/**
 * coupangPartnersClient.ts — Coupang Partners (Affiliate) Open API client.
 *
 * Auth: CEA HmacSHA256 signed header
 *   Authorization: CEA algorithm=HmacSHA256, access-key=…, signed-date=…, signature=…
 *   signature = HexHmacSHA256(SECRET, signedDate + METHOD + path + query)
 *   signedDate: yyMMdd'T'HHmmss'Z' (UTC)
 *
 * Used as the REAL Coupang-side retail price source for the comparator —
 * replaces the mock JSON-LD benchmark price.
 */
import axios from 'axios';
import crypto from 'crypto';

const BASE = 'https://api-gateway.coupang.com';
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || '';
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || '';
const SUB_ID = process.env.COUPANG_SUB_ID || 'seondal';

export function isCoupangConfigured(): boolean {
  return ACCESS_KEY.length > 0 && SECRET_KEY.length > 0;
}

export interface CoupangProduct {
  productId: number;
  productName: string;
  productPrice: number; // KRW
  productImage: string;
  productUrl: string;
  categoryName?: string;
  isRocket?: boolean;
  isFreeShipping?: boolean;
  keyword?: string;
  rank?: number;
}

// --- HMAC signing -----------------------------------------------------------
function signedDate(): string {
  // Coupang expects yyMMdd'T'HHmmss'Z' in UTC
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    String(d.getUTCFullYear()).slice(2) + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  );
}

function buildAuthHeader(method: string, path: string, query: string): string {
  const date = signedDate();
  const message = date + method + path + query;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${date}, signature=${signature}`;
}

async function call<T>(method: string, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = Object.entries({ subId: SUB_ID, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  const res = await axios.get(`${BASE}${path}?${qs}`, {
    headers: { Authorization: buildAuthHeader(method, path, qs) },
    timeout: 15000,
  });
  if (res.data?.rCode !== '0') {
    throw new Error(`Coupang API rCode=${res.data?.rCode} ${res.data?.rMessage || ''}`.trim());
  }
  return res.data.data as T;
}

// --- Endpoints (with light in-memory cache) ---------------------------------
const cache = new Map<string, { at: number; data: any }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
let searchWindow: number[] = []; // rate guard: 50 calls/min for /search

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** 카테고리별 베스트 상품 (실시간 쿠팡 판매가) */
export function bestCategories(categoryId: number, limit = 50): Promise<CoupangProduct[]> {
  return cached(`best:${categoryId}:${limit}`, () =>
    call<CoupangProduct[]>('GET', `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/${categoryId}`, { limit })
  );
}

/** 골드박스 딜 (매일 07:30 갱신) */
export function goldbox(): Promise<CoupangProduct[]> {
  return cached('goldbox', () =>
    call<CoupangProduct[]>('GET', '/v2/providers/affiliate_open_api/apis/openapi/products/goldbox', {})
  );
}

/** 쿠팡 PL 전체 / 브랜드별 */
export function coupangPL(brandId?: number, limit = 50): Promise<CoupangProduct[]> {
  const path = brandId
    ? `/v2/providers/affiliate_open_api/apis/openapi/products/coupangPL/${brandId}`
    : '/v2/providers/affiliate_open_api/apis/openapi/products/coupangPL';
  return cached(`pl:${brandId || 'all'}:${limit}`, () => call<CoupangProduct[]>('GET', path, { limit }));
}

/** 키워드 검색 (50/min rate guard) */
export async function searchProducts(keyword: string, limit = 10): Promise<CoupangProduct[]> {
  const now = Date.now();
  searchWindow = searchWindow.filter((t) => now - t < 60_000);
  if (searchWindow.length >= 45) {
    const wait = 60_000 - (now - searchWindow[0]);
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  }
  searchWindow.push(Date.now());
  const data = await call<{ productData: CoupangProduct[] }>(
    'GET', '/v2/providers/affiliate_open_api/apis/openapi/products/search', { keyword, limit }
  );
  return data.productData || [];
}

/** 카테고리 코드 (관심 도메인) */
export const COUPANG_CATEGORIES: Record<number, string> = {
  1011: '출산/유아동',
  1030: '유아동패션',
  1013: '주방용품',
  1020: '완구/취미',
  1010: '뷰티',
  1014: '생활용품',
  1015: '홈인테리어',
  1017: '스포츠/레저',
};
