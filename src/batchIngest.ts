import 'dotenv/config';
import { initDb, upsertProduct, queryProducts } from './db';
import { buildProductJsonLd } from './scraper';
import { miningEnrichJsonLd } from './ontologyMining';
import { classifyProductViabilityWithKimi } from './kimiClassifier';

export interface SeedItem {
  productId: string;
  title: string;
  priceUsd: number;
  currency: string;
  category: string;
  sourceUrl: string;
  imageUrl: string;
  rawHtmlGcsUrl: string;
  shippingWeightGrm: number;
  factoryCity: string;
  moq: number;
  koreanBenchmarkPriceKrw: number;
}

/**
 * High-Value Seed Products Dataset across 1688 Wholesale Categories
 */
const SEED_PRODUCTS_DATASET: SeedItem[] = [
  {
    productId: "1688-romper-88201",
    title: "2025 여름 신생아 여아 순면 스플라이싱 롬퍼 아동복 수트",
    priceUsd: 12.50,
    currency: "USD",
    category: "Wholesale Apparel > Rompers",
    sourceUrl: "https://detail.1688.com/offer/8820101.html",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    rawHtmlGcsUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1688-romper-88201%2Fsource.html",
    shippingWeightGrm: 180,
    factoryCity: "Guangzhou",
    moq: 1,
    koreanBenchmarkPriceKrw: 48000
  },
  {
    productId: "1688-romper-88202",
    title: "프리미엄 100% 오가닉 코튼 민소매 유아 바디수트 롬퍼 2종 세트",
    priceUsd: 14.80,
    currency: "USD",
    category: "Wholesale Apparel > Rompers",
    sourceUrl: "https://detail.1688.com/offer/8820202.html",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005006240212345%2Fimage.jpg",
    rawHtmlGcsUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1688-romper-88202%2Fsource.html",
    shippingWeightGrm: 220,
    factoryCity: "Foshan",
    moq: 3,
    koreanBenchmarkPriceKrw: 55000
  },
  {
    productId: "1688-living-99101",
    title: "북유럽 감성 모던 실리콘 유아 식기 4종 풀세트 (흡착 식판+스푼)",
    priceUsd: 8.90,
    currency: "USD",
    category: "Home & Living > Baby Tableware",
    sourceUrl: "https://detail.1688.com/offer/9910101.html",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005007321459876%2Fimage.jpg",
    rawHtmlGcsUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1688-living-99101%2Fsource.html",
    shippingWeightGrm: 320,
    factoryCity: "Shenzhen",
    moq: 5,
    koreanBenchmarkPriceKrw: 32000
  },
  {
    productId: "1688-tech-77301",
    title: "초소형 휴대용 음이온 유아 수면 공기청정기 (USB 충전식)",
    priceUsd: 16.50,
    currency: "USD",
    category: "Consumer Electronics > Portable Purifiers",
    sourceUrl: "https://detail.1688.com/offer/7730101.html",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    rawHtmlGcsUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1688-tech-77301%2Fsource.html",
    shippingWeightGrm: 290,
    factoryCity: "Shenzhen",
    moq: 2,
    koreanBenchmarkPriceKrw: 62000
  }
];

/**
 * Ingest Batch Dataset into Cloud SQL PostgreSQL Database
 */
export async function executeBatchIngestion(): Promise<number> {
  console.log(`\n==================================================`);
  console.log(`[Batch Ingestion Engine] Initializing database pool...`);
  console.log(`==================================================`);

  await initDb();

  let count = 0;
  for (const item of SEED_PRODUCTS_DATASET) {
    console.log(`[Batch Ingest] Processing Item: ${item.productId} (${item.title})...`);

    // 1. Build Base Schema.org JSON-LD
    const rawJsonLd = buildProductJsonLd(
      item.productId,
      item.title,
      item.priceUsd,
      item.currency,
      item.imageUrl,
      item.sourceUrl
    );

    // 2. Taxonomy Mining & Enrichment
    const enrichedJsonLd = miningEnrichJsonLd(rawJsonLd);

    // 3. Kimi AI Reasoning Sourcing MD Evaluation
    const kimiViability = await classifyProductViabilityWithKimi({
      productId: item.productId,
      title: item.title,
      price: item.priceUsd,
      currency: item.currency,
      dataJsonLd: enrichedJsonLd
    });

    // Combine enriched properties
    const finalDataJsonLd = {
      ...enrichedJsonLd,
      kimiViability
    };

    const scrapedProduct = {
      productId: item.productId,
      title: item.title,
      price: item.priceUsd,
      currency: item.currency,
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
      scrapedAt: new Date().toISOString(),
      rawHtmlGcsUrl: item.rawHtmlGcsUrl,
      dataJsonLd: finalDataJsonLd
    };

    await upsertProduct(scrapedProduct);
    count++;
    console.log(`[Batch Ingest] ✓ Successfully stored product '${item.productId}' in Cloud SQL PostgreSQL!`);
  }

  const allProducts = await queryProducts();
  console.log(`\n==================================================`);
  console.log(`🎉 [Batch Ingestion Complete] Total Cloud SQL Database Records: ${allProducts.length}`);
  console.log(`==================================================`);

  return count;
}

// Standalone runner
if (require.main === module) {
  executeBatchIngestion().catch(console.error);
}
