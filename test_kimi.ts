import 'dotenv/config';
import { classifyProductViabilityWithKimi } from './src/kimiClassifier';

async function main() {
  const sampleProduct = {
    productId: "1005008543210123",
    title: "신생아 여아 코튼 스플라이싱 여름 롬퍼 수트",
    price: 19.99,
    currency: "USD",
    dataJsonLd: {
      name: "신생아 여아 코튼 스플라이싱 여름 롬퍼 수트",
      brand: { name: "Guangzhou BabyCare Factory" },
      offers: { moq: { value: 1 } },
      additionalProperty: [
        { name: "Shipping Weight", value: 180, unitCode: "GRM" },
        { name: "Korean Benchmark Retail Price", value: 58000, unitCode: "KRW" }
      ]
    }
  };

  console.log("🚀 Testing Kimi AI Reasoning (moonshot-v1-8k) Product Viability Classifier...");
  const assessment = await classifyProductViabilityWithKimi(sampleProduct);

  console.log("\n==================================================");
  console.log("🏆 KIMI MD PERSONA PRODUCT VIABILITY ASSESSMENT");
  console.log("==================================================");
  console.log(`📌 Product ID: ${assessment.productId}`);
  console.log(`🏅 Viability Grade: ${assessment.viabilityGrade} (Overall Score: ${assessment.overallScore}/100)`);
  console.log(`\n🧠 Tacit Knowledge Scores (암묵지 5대 지표):`);
  console.log(`  - 📸 Visual Thumbnail Appeal: ${assessment.tacitKnowledgeScores.visualThumbnailAppeal}/10`);
  console.log(`  - 📦 Volumetric Margin Density: ${assessment.tacitKnowledgeScores.volumetricMarginDensity}/10`);
  console.log(`  - 🛡️ CS & Return Risk Level (Lower=Safer): ${assessment.tacitKnowledgeScores.csReturnRiskLevel}/10`);
  console.log(`  - ⏱️ Seasonality Timing: ${assessment.tacitKnowledgeScores.seasonalityTiming}/10`);
  console.log(`  - 🎁 Bundling / Cross-sell Potential: ${assessment.tacitKnowledgeScores.bundlingCrossSellPotential}/10`);
  console.log(`\n👨‍💼 Expert MD Opinion:\n${assessment.mdExpertOpinion}`);
  console.log(`\n🏷️ Recommended Pricing & Bundling Strategy:`);
  console.log(`  - Target Retail Price: ₩${assessment.recommendedPricingStrategy.targetRetailPriceKrw.toLocaleString()}`);
  console.log(`  - Bundle Strategy: ${assessment.recommendedPricingStrategy.recommendedBundleStrategy}`);
}

main().catch(console.error);
