/**
 * coupangBenchmarkEngine.ts — Category-level REAL retail benchmarks.
 *
 * Coupang Partners prices are RETAIL prices. For each tracked category we
 * pull the current best-sellers and derive a median retail anchor + top
 * items — used by the comparator when a per-product keyword search misses,
 * and shown in the dashboard as "카테고리별 쿠팡 실측 벤치마크".
 */
import {
  bestCategories, goldbox, isCoupangConfigured, COUPANG_CATEGORIES, CoupangProduct,
} from './coupangPartnersClient';
import { logEvent } from './observability';

export interface CategoryBenchmark {
  categoryId: number;
  categoryName: string;
  medianPriceKrw: number;
  itemCount: number;
  topItems: { productName: string; productPrice: number; productUrl: string; isRocket?: boolean }[];
  fetchedAt: string;
}

const benchmarks = new Map<number, CategoryBenchmark>();

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
}

/** Pull best-sellers for every tracked category + goldbox. */
export async function refreshCategoryBenchmarks(): Promise<CategoryBenchmark[]> {
  if (!isCoupangConfigured()) {
    logEvent('warn', 'coupang.benchmarks_skipped', { reason: 'COUPANG_ACCESS_KEY/SECRET_KEY not set' });
    return [];
  }
  const out: CategoryBenchmark[] = [];
  for (const [idStr, name] of Object.entries(COUPANG_CATEGORIES)) {
    const categoryId = parseInt(idStr);
    try {
      const items = await bestCategories(categoryId, 50);
      if (items.length === 0) continue;
      const bench: CategoryBenchmark = {
        categoryId,
        categoryName: name,
        medianPriceKrw: median(items.map((i) => i.productPrice)),
        itemCount: items.length,
        topItems: items.slice(0, 5).map((i) => ({
          productName: i.productName,
          productPrice: i.productPrice,
          productUrl: i.productUrl,
          isRocket: i.isRocket,
        })),
        fetchedAt: new Date().toISOString(),
      };
      benchmarks.set(categoryId, bench);
      out.push(bench);
      logEvent('info', 'coupang.benchmark_refreshed', {
        categoryId, categoryName: name, medianPriceKrw: bench.medianPriceKrw, itemCount: bench.itemCount,
      });
    } catch (err: any) {
      logEvent('error', 'coupang.benchmark_failed', { categoryId, categoryName: name, error: err.message });
    }
  }
  return out;
}

export function listCategoryBenchmarks(): CategoryBenchmark[] {
  return Array.from(benchmarks.values());
}

/**
 * Map a product (1688-side) to the closest Coupang category benchmark via
 * title keywords. Returns undefined when no category fits.
 */
export function benchmarkForProduct(product: any): CategoryBenchmark | undefined {
  const title = (product.title || '').toLowerCase();
  const rules: [RegExp, number][] = [
    [/롬퍼|바디수트|유아복|아기옷|아동복|신생아|유아/, 1030],   // 유아동패션
    [/출산|수유|기저귀|젖병|침대|모빌/, 1011],                 // 출산/유아동
    [/식기|턱받이|주방|물통|컵|접시/, 1013],                   // 주방용품
    [/치발기|장난감|완구|블록|인형/, 1020],                    // 완구/취미
    [/화장|뷰티|크림|로션|샴푸/, 1010],                        // 뷰티
    [/욕실|세제|청소|수건|생활/, 1014],                        // 생활용품
    [/인테리어|조명|커튼|러그/, 1015],                         // 홈인테리어
    [/울동|울동화|울동복|울동용품|울동|스포츠|요가/, 1017],      // 스포츠/레저
  ];
  for (const [re, categoryId] of rules) {
    if (re.test(title)) {
      const bench = benchmarks.get(categoryId);
      if (bench) return bench;
    }
  }
  // fall back to baby/fashion default when any kid-related term
  return undefined;
}
