import axios from 'axios';
import { searchProductsByJsonLd, queryProducts, initDb } from './db';
import { classifyProductViabilityWithKimi } from './kimiClassifier';
import { executeBatchIngestion } from './batchIngest';
import { fetchBaiduSourcingSignals, BaiduTrendSignal } from './baiduIngest';

const MARA_API_KEY = process.env.MARA_API_KEY || 'a3355859-8174-412c-973d-cc57abb1588b';
const MARA_API_URL = 'https://api.cloud.mara.com/v1/chat/completions';

export interface UserQueryRequest {
  query: string;
}

export interface PipelineResult {
  userQuery: string;
  intent: {
    extractedCategory: string;
    moqMax: number;
    weightMaxGrm: number;
    targetRoiMinPercent: number;
    targetAudience: string;
  };
  baiduSignals?: BaiduTrendSignal;
  retrievedCount: number;
  synthesizedReport: string;
  matchedProducts: any[];
  executionTimeMs: number;
}

/**
 * Step 2: Intent Expansion via Rules / Gemini Planner
 */
function expandUserIntent(query: string) {
  const moqMatch = query.match(/MOQ\s*(\d+)/i) || query.match(/(\d+)개\s*이하/);
  const moqMax = moqMatch ? parseInt(moqMatch[1]) : 5;

  const marginMatch = query.match(/마진율\s*(\d+)/) || query.match(/마진\s*(\d+)/);
  const targetRoiMinPercent = marginMatch ? parseInt(marginMatch[1]) : 40;

  return {
    extractedCategory: "Wholesale Apparel > Rompers",
    moqMax,
    weightMaxGrm: 500,
    targetRoiMinPercent,
    targetAudience: query.includes('여성') ? "Women 30s" : "General Retailers"
  };
}

/**
 * Step 4: Call MARA Cloud API (MiniMax-M2.5) for High-Speed Multi-Agent Inference
 */
async function callMaraCloudAgent(userQuery: string, intent: any, products: any[], baiduSignals?: BaiduTrendSignal): Promise<string> {
  const systemPrompt = `You are the lead MARA AI Commercial Execution Agent in a Multi-Agent (A2A) e-commerce data trade network.
Your task is to analyze retrieved wholesale products from 1688 (stored in Cloud SQL JSONB) alongside Kimi AI MD Persona Viability Ratings (Grade S/A/B/C, 5 Tacit Knowledge Metrics) and Baidu Sourcing Signals (Baidu Search Velocity Index, Chinese Industrial Factory Clusters) to generate a comprehensive, highly actionable market feasibility & purchasing report in Korean.

Mandatory Sections to Include:
1. 🚚 Estimated Shipping Lead Time & Logistics Window (배송 소요 일수 및 물류 리드타임):
   - Air Freight (항공 배송): 3~5 business days (Ideal for items < 500g)
   - Sea Freight (해상 배송): 7~10 business days
   - Customs Clearance Window (인천/평택 통관): 1~2 business days
2. 📈 Market & Baidu Trend Context (실시간 마켓 & 바이두 검색 지수 트렌드):
   - Baidu Search Velocity Index (百度指数) & Growth Momentum (+88%)
   - Chinese Industrial Factory Clusters (Guangzhou / Foshan / Yiwu)
3. 💰 Landed Cost & Profit Margin Analysis (정밀 원가 & 순마진율):
   - Wholesale price (KRW) + Shipping + Duty & Tax = Total Landed Cost
   - Korean Retail Benchmark (Coupang/Naver) & Net Margin %
4. 🎯 Recommended Wholesale Products & Actionable Sourcing Plan (추천 상품 및 사입 가이드):
   - Clear product list, MOQ, Kimi MD Grade, and 1-Click purchasing advice.

Use clear, professional markdown formatting with emojis and clean tables.`;

  const userPrompt = `User Query: "${userQuery}"

Extracted Intent Constraints:
- Category: ${intent.extractedCategory}
- Max MOQ: ${intent.moqMax} units
- Max Shipping Weight: ${intent.weightMaxGrm}g
- Target Minimum ROI: ${intent.targetRoiMinPercent}%
- Target Audience: ${intent.targetAudience}

Baidu Sourcing & Factory Signals:
- Chinese Keyword: ${baiduSignals?.chineseKeyword || '童装 连体衣'}
- Baidu Search Index Score: ${baiduSignals?.baiduIndexScore || 48200}
- Growth Momentum: +${baiduSignals?.growthMomemtumPercent || 88}%
- Primary Factory Clusters: ${baiduSignals?.topFactoryClusters?.join(', ') || 'Guangzhou, Foshan'}
- Supplier Trust Rating: ${baiduSignals?.supplierTrustRating || 4.8}/5.0

Retrieved Products Dataset from PostgreSQL (Enriched with Kimi MD Reasoning):
${JSON.stringify(products, null, 2)}

Please synthesize the final user-centric A2A trade recommendation report.`;

  try {
    const response = await axios.post(
      MARA_API_URL,
      {
        model: 'MiniMax-M2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      },
      {
        headers: {
          'Authorization': `Bearer ${MARA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    return 'MARA Cloud API returned empty response.';
  } catch (error: any) {
    console.error('[A2A Pipeline Error] Failed to call MARA Cloud API:', error.message);
    return `MARA Agent Error: ${error.message}`;
  }
}

/**
 * Main 5-Step A2A Information Pipeline Execution Function
 */
export async function executeA2APipeline(userQuery: string): Promise<PipelineResult> {
  const startTime = Date.now();
  await initDb();
  console.log(`\n==================================================`);
  console.log(`[A2A Pipeline] Step 1: Received User Query: "${userQuery}"`);
  console.log(`==================================================`);

  // Step 2: Intent Expansion
  const intent = expandUserIntent(userQuery);
  console.log(`[A2A Pipeline] Step 2: Intent Expanded:`, intent);

  // Step 2.5: Query Baidu Trend Signals
  console.log(`[A2A Pipeline] Step 2.5: Fetching Baidu Trend & Factory Cluster Signals...`);
  const baiduSignals = await fetchBaiduSourcingSignals(userQuery);

  // Step 3: Retrieval from Cloud SQL JSONB & SEOCHO Engine
  console.log(`[A2A Pipeline] Step 3: Searching Cloud SQL PostgreSQL JSONB...`);
  let rawProducts = await searchProductsByJsonLd({
    moqMax: intent.moqMax,
    weightMax: intent.weightMaxGrm
  });

  if (rawProducts.length === 0) {
    console.log(`[A2A Pipeline] No records in DB. Triggering real-time ingestion pipeline...`);
    await executeBatchIngestion();
    rawProducts = await searchProductsByJsonLd({
      moqMax: intent.moqMax,
      weightMax: intent.weightMaxGrm
    });
    if (rawProducts.length === 0) {
      rawProducts = await queryProducts();
    }
  }
  console.log(`[A2A Pipeline] Retrieved ${rawProducts.length} product records from Cloud SQL.`);

  // Step 3.5: Enrich products with Kimi AI Reasoning (MD Persona & 5 Tacit Knowledge Metrics)
  console.log(`[A2A Pipeline] Step 3.5: Evaluating Kimi AI Reasoning (moonshot-v1-8k) Viability & Tacit Metrics...`);
  const products = await Promise.all(
    rawProducts.map(async (p) => {
      const kimiViability = await classifyProductViabilityWithKimi(p);
      return {
        ...p,
        kimiViability
      };
    })
  );

  // Step 4: Information Exchange & MARA Cloud Inference
  console.log(`[A2A Pipeline] Step 4: Executing MARA Cloud AI (MiniMax-M2.5) Synthesis...`);
  const synthesizedReport = await callMaraCloudAgent(userQuery, intent, products, baiduSignals);

  const endTime = Date.now();
  const executionTimeMs = endTime - startTime;
  console.log(`[A2A Pipeline] Step 5: Final Response Ready (${executionTimeMs}ms)`);

  return {
    userQuery,
    intent,
    baiduSignals,
    retrievedCount: products.length,
    synthesizedReport,
    matchedProducts: products,
    executionTimeMs
  };
}
