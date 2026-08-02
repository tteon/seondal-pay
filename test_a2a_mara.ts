import 'dotenv/config';
import { executeA2APipeline } from './src/a2aPipeline';

async function main() {
  const userQuery = "요즘 한국에서 30대 여성층에 인기 있는 중국 롬퍼 아동복 수입 아이템을 찾고, MOQ 5개 이하, 마진율 40% 이상인 최적의 추천 상품과 상세 스펙 및 예상 마진을 정리해줘.";
  
  console.log("🚀 Testing 5-Step A2A Multi-Agent Information Pipeline...");
  const result = await executeA2APipeline(userQuery);

  console.log("\n==================================================");
  console.log("📊 A2A PIPELINE EXECUTION SUMMARY");
  console.log("==================================================");
  console.log(`⏱️ Execution Time: ${result.executionTimeMs} ms`);
  console.log(`🔍 Retrieved Cloud SQL Records: ${result.retrievedCount}`);
  console.log(`🎯 Extracted Intent Constraints:`, result.intent);
  
  console.log("\n==================================================");
  console.log("🤖 MARA CLOUD AGENT (MiniMax-M2.5) SYNTHESIZED REPORT");
  console.log("==================================================");
  console.log(result.synthesizedReport);
}

main().catch(console.error);
