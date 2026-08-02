/**
 * coupangSellerClient.ts — Coupang Wing Seller API (seller_api) client.
 *
 * ⚠️ RULE (절대): 정산(settlement)·주문·반품 관련 엔드포인트는 일절 사용하지
 * 않는다. 이 클라이언트는 **상품 정보(등록 상품 목록/상세/가격)만** 다룬다.
 *
 * Auth: same CEA HmacSHA256 scheme as the Partners API.
 * The credential is vendor-scoped: only OUR OWN listings (vendorId) are visible.
 */
import axios from 'axios';
import crypto from 'crypto';

const BASE = 'https://api-gateway.coupang.com';
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || '';
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || '';
export const COUPANG_VENDOR_ID = process.env.COUPANG_VENDOR_ID || 'A01746811';

export function isSellerConfigured(): boolean {
  return ACCESS_KEY.length > 0 && SECRET_KEY.length > 0;
}

export interface SellerProductSummary {
  sellerProductId: number;
  sellerProductName: string;
  statusName: string;
  brand?: string;
  displayCategoryCode?: number;
  createdAt?: string;
}

export interface SellerProductItem {
  vendorItemId?: number;
  itemName?: string;
  salePrice?: number;
  originalPrice?: number;
  maximumBuyCount?: number;
}

export interface SellerProductDetail extends SellerProductSummary {
  displayProductName?: string;
  items?: SellerProductItem[];
}

// --- HMAC signing (same scheme as partners) ---
function signedDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    String(d.getUTCFullYear()).slice(2) + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  );
}
function authHeader(method: string, path: string, query: string): string {
  const date = signedDate();
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(date + method + path + query).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${date}, signature=${signature}`;
}

async function call<T>(method: string, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const res = await axios.get(`${BASE}${path}${qs ? '?' + qs : ''}`, {
    headers: { Authorization: authHeader(method, path, qs) },
    timeout: 15000,
  });
  if (res.data?.code !== 'SUCCESS') {
    throw new Error(`Seller API code=${res.data?.code} ${res.data?.message || ''}`.trim());
  }
  return res.data.data as T;
}

const PATH = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';

/** List our own listings created within a (≤10min) window. */
export function listSellerProducts(createdAtFrom: Date, createdAtTo: Date): Promise<SellerProductSummary[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 19);
  return call<SellerProductSummary[]>('GET', `${PATH}/time-frame`, {
    vendorId: COUPANG_VENDOR_ID,
    createdAtFrom: fmt(createdAtFrom),
    createdAtTo: fmt(createdAtTo),
  });
}

/** Scan recent days (30×10-min windows/day is capped; we sample per day). */
export async function scanSellerProducts(daysBack = 180): Promise<SellerProductSummary[]> {
  const found = new Map<number, SellerProductSummary>();
  const now = Date.now();
  for (let d = 0; d < daysBack; d += 1) {
    const to = new Date(now - d * 86_400_000);
    const from = new Date(to.getTime() - 10 * 60_000);
    try {
      const items = await listSellerProducts(from, to);
      for (const p of items) found.set(p.sellerProductId, p);
    } catch { /* window error — continue scanning */ }
  }
  return Array.from(found.values());
}

/** Full detail of one listing (includes items[].salePrice). */
export function getSellerProduct(sellerProductId: number): Promise<SellerProductDetail> {
  return call<SellerProductDetail>('GET', `${PATH}/${sellerProductId}`, {});
}
