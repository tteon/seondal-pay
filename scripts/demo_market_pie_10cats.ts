/**
 * demo_market_pie_10cats.ts — Full data-flow demo across 10 categories.
 *
 * Seeds realistic Coupang observation sets (the shape OpenClaw reports),
 * then runs market pie + entry-margin analysis per category against a
 * representative 1688 wholesale candidate (¥ price like AIPrice shows).
 *
 * Run: npx ts-node scripts/demo_market_pie_10cats.ts  (server must be up)
 */
import axios from 'axios';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

interface Seed { productName: string; priceKrw: number; monthlySales: number; url?: string }
interface Cat {
  group: string; category: string;
  obs: Seed[];
  wholesale: { title: string; cny: number; weightGrm: number; landedNote: string };
}

const CATS: Cat[] = [
  {
    group: '롬퍼', category: '유아동패션',
    obs: [
      { productName: '신생아 순면 스플라이싱 롬퍼 여아', priceKrw: 12900, monthlySales: 1840 },
      { productName: '유아 여름 반팔 롬퍼 3종 세트', priceKrw: 18900, monthlySales: 1320 },
      { productName: '아기 메쉬 통풍 바디수트', priceKrw: 9900, monthlySales: 960 },
      { productName: '신생아 오가닉 롬퍼 2팩', priceKrw: 15900, monthlySales: 610 },
      { productName: '유아동 여름 롬퍼 특가', priceKrw: 8900, monthlySales: 450 },
    ],
    wholesale: { title: '夏季婴儿纯棉连体衣 롬퍼', cny: 12.5, weightGrm: 320, landedNote: '의류 8% 관세' },
  },
  {
    group: '실리콘 식기', category: '주방용품',
    obs: [
      { productName: '유아 실리콘 흡착 식판 4종 세트', priceKrw: 15900, monthlySales: 2210 },
      { productName: '아기 실리콘 스푼 포크 세트', priceKrw: 8900, monthlySales: 1450 },
      { productName: '흡착식판 빨대컵 풀세트', priceKrw: 21900, monthlySales: 880 },
      { productName: '실리콘 이유식 볼 흡착', priceKrw: 11900, monthlySales: 720 },
      { productName: '유아 실리콘 턱받이 방수', priceKrw: 6900, monthlySales: 540 },
    ],
    wholesale: { title: '硅胶儿童餐具套装 식기세트', cny: 8.9, weightGrm: 450, landedNote: '기타 5% 관세' },
  },
  {
    group: '치발기', category: '완구/취미',
    obs: [
      { productName: '유아 원목 치발기 세트', priceKrw: 9900, monthlySales: 1120 },
      { productName: '실리콘 치발기 당근 모양', priceKrw: 5900, monthlySales: 1980 },
      { productName: '아기 치발기 케이스 포함', priceKrw: 7900, monthlySales: 760 },
      { productName: '목재 치발기 비즈 세트', priceKrw: 12900, monthlySales: 340 },
      { productName: '치발기 장난감 3종', priceKrw: 6900, monthlySales: 290 },
    ],
    wholesale: { title: '婴儿木质牙胶 치발기', cny: 3.8, weightGrm: 90, landedNote: '완구 0% (RCEP)' },
  },
  {
    group: '아기 샴푸', category: '뷰티',
    obs: [
      { productName: '아기 올인원 샴푸 앤 바디 500ml', priceKrw: 14900, monthlySales: 2680 },
      { productName: '유아 저자극 버블 샴푸', priceKrw: 11900, monthlySales: 1540 },
      { productName: '신생아 천연 샴푸', priceKrw: 18900, monthlySales: 920 },
      { productName: '아기 샴푸 리필 세트', priceKrw: 9900, monthlySales: 810 },
      { productName: '키즈 샴푸 눈 안아픈', priceKrw: 10900, monthlySales: 660 },
    ],
    wholesale: { title: '婴儿洗发沐浴露 샴푸', cny: 9.5, weightGrm: 550, landedNote: '기타 5% 관세' },
  },
  {
    group: '아기 수건', category: '생활용품',
    obs: [
      { productName: '아기 모시 손수건 10장 세트', priceKrw: 11900, monthlySales: 1890 },
      { productName: '신생아 대나무 수건 6장', priceKrw: 14900, monthlySales: 1240 },
      { productName: '유아 후드 비치타올', priceKrw: 16900, monthlySales: 730 },
      { productName: '아기 거즈 수건 5장', priceKrw: 8900, monthlySales: 690 },
      { productName: '모시 목욕수건 대형', priceKrw: 12900, monthlySales: 410 },
    ],
    wholesale: { title: '婴儿纱布毛巾 수건', cny: 6.0, weightGrm: 180, landedNote: '의류 8% 관세' },
  },
  {
    group: '수유등', category: '홈인테리어',
    obs: [
      { productName: '수유등 무드등 충전식', priceKrw: 19900, monthlySales: 1560 },
      { productName: '아기방 수면 조명 달님', priceKrw: 24900, monthlySales: 980 },
      { productName: 'LED 수유 보조등 타이머', priceKrw: 15900, monthlySales: 870 },
      { productName: '토끼 실리콘 수유등', priceKrw: 17900, monthlySales: 640 },
      { productName: '아기 수면등 프로젝터', priceKrw: 29900, monthlySales: 390 },
    ],
    wholesale: { title: '充电小夜灯 수유등', cny: 14.0, weightGrm: 250, landedNote: '기타 5% 관세' },
  },
  {
    group: '요가매트', category: '스포츠/레저',
    obs: [
      { productName: 'TPE 요가매트 10mm 홈트', priceKrw: 24900, monthlySales: 3120 },
      { productName: 'NBR 요가매트 15mm', priceKrw: 19900, monthlySales: 2340 },
      { productName: '프리미엄 PU 요가매트', priceKrw: 49900, monthlySales: 1180 },
      { productName: '접이식 울트라 요가매트', priceKrw: 32900, monthlySales: 860 },
      { productName: '입문자 요가매트 8mm', priceKrw: 16900, monthlySales: 720 },
    ],
    wholesale: { title: 'TPE瑜伽垫 요가매트', cny: 22.0, weightGrm: 900, landedNote: '기타 5% 관세' },
  },
  {
    group: '아기 간식', category: '식품',
    obs: [
      { productName: '유기농 아기 쌀과자 6봉', priceKrw: 12900, monthlySales: 2890 },
      { productName: '아기 치즈 요거트볼', priceKrw: 9900, monthlySales: 1750 },
      { productName: '유아 과일 퓨레 10팩', priceKrw: 15900, monthlySales: 1340 },
      { productName: '아기 떡뻥 오리지널', priceKrw: 4900, monthlySales: 4100 },
      { productName: '무설탕 아기 시리얼', priceKrw: 11900, monthlySales: 620 },
    ],
    wholesale: { title: '婴幼儿米饼 아기과자', cny: 7.0, weightGrm: 200, landedNote: '식품 검역 별도' },
  },
  {
    group: '미니 선풍기', category: '가전디지털',
    obs: [
      { productName: '휴이용 미니 핸디 선풍기', priceKrw: 12900, monthlySales: 3560 },
      { productName: '넥밴드 목걸이 선풍기', priceKrw: 19900, monthlySales: 2870 },
      { productName: '클립형 유모차 선풍기', priceKrw: 15900, monthlySales: 1940 },
      { productName: 'USB 탁상 미니 선풍기', priceKrw: 9900, monthlySales: 1280 },
      { productName: '대용량 배터리 핸디팬', priceKrw: 24900, monthlySales: 950 },
    ],
    wholesale: { title: '迷你挂脖风扇 선풍기', cny: 11.0, weightGrm: 280, landedNote: '전기용품 안전확인' },
  },
  {
    group: '기저귀 가방', category: '출산/유아동',
    obs: [
      { productName: '기저귀 가방 백팩 대용량', priceKrw: 34900, monthlySales: 1430 },
      { productName: '출산 외출 다기능 가방', priceKrw: 27900, monthlySales: 1120 },
      { productName: '기저귀 토트백 경량', priceKrw: 22900, monthlySales: 780 },
      { productName: '유모차 걸이 수납백', priceKrw: 15900, monthlySales: 690 },
      { productName: '방수 기저귀 파우치', priceKrw: 9900, monthlySales: 540 },
    ],
    wholesale: { title: '妈咪包大容量 가방', cny: 18.0, weightGrm: 650, landedNote: '의류 8% 관세' },
  },
];

function landedCost(cny: number, weightGrm: number, tariffRate: number): number {
  const base = Math.round(cny * 190);
  const shipping = Math.max(2000, Math.round(weightGrm * 7));
  return base + shipping + Math.round(base * tariffRate);
}

function tariffFor(cat: string): number {
  if (['유아동패션', '생활용품', '출산/유아동'].includes(cat)) return 0.08;
  if (['완구/취미', '가전디지털'].includes(cat)) return 0.0;
  return 0.05;
}

async function main() {
  console.log('=== [1/3] Seeding observations (OpenClaw 형식) ===');
  let total = 0;
  for (const c of CATS) {
    for (const o of c.obs) {
      await axios.post(`${BASE}/api/ingest/coupang-price`, {
        productName: o.productName, priceKrw: o.priceKrw, monthlySales: o.monthlySales,
        category: c.category, url: o.url || `https://www.coupang.com/vp/products/${1000000 + total}`,
        source: 'openclaw-demo',
      });
      total++;
    }
  }
  console.log(`  → ${total} observations ingested`);

  console.log('\n=== [2/3] Market Pie per category ===');
  const pies: any[] = [];
  for (const c of CATS) {
    const pie = (await axios.get(`${BASE}/api/market-pie`, { params: { group: c.group } })).data;
    pies.push({ cat: c, pie });
    const top1 = pie.top[0];
    console.log(`  ${c.group.padEnd(8)} | TOP1: ${top1 ? `${top1.productName.slice(0, 20)}… ${(top1.sharePercent)}%` : '없음'} | 가격대 ₩${pie.priceMinKrw.toLocaleString()}~${pie.priceMaxKrw.toLocaleString()} | 월판매 ${pie.totalMonthlySales.toLocaleString()}건`);
  }

  console.log('\n=== [3/3] Entry analysis (진입 마진) per category ===');
  console.log('카테고리    | 우리 랜디드 | 최저가 진입가 | 진입 ROI | 희생 마진 | 판정');
  console.log('-'.repeat(100));
  for (const { cat } of pies) {
    const lc = landedCost(cat.wholesale.cny, cat.wholesale.weightGrm, tariffFor(cat.category));
    const ea = (await axios.post(`${BASE}/api/market-pie/entry`, {
      group: cat.group, landedCostKrw: lc, targetRoiPct: 30,
    })).data;
    const ms = ea.minimumMarginSacrifice;
    if (ms) {
      const verdict = ms.entryRoiPercent >= 30 ? '✅ 목표 달성' : ms.entryRoiPercent >= 10 ? '🟡 마진 축소 진입' : '⛔ 진입 비추';
      console.log(
        `${cat.group.padEnd(8)} | ₩${lc.toLocaleString().padStart(8)} | ₩${ms.entryPriceKrw.toLocaleString().padStart(8)} | ${String(ms.entryRoiPercent).padStart(6)}% | ₩${ms.sacrificeKrw.toLocaleString().padStart(8)} | ${verdict}`
      );
    } else {
      console.log(`${cat.group.padEnd(8)} | ₩${lc.toLocaleString().padStart(8)} | 데이터 부족`);
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
