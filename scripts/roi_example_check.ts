import { compareProductSync } from '../src/comparatorEngine';

// 사용자 예시: 1688 夏季防晒面罩 ¥1.90, 소형 경량(50g 가정), 쿠팡 유사품 ₩6,900 가정
const p = {
  productId: '1688-neck-gaiter-001',
  title: '夏季围脖骑行防晒面罩冰丝挂耳脖套 (여름 넥게이터 자외선차단 마스크)',
  price: 1.90, currency: 'CNY',
  dataJsonLd: { category: 'apparel', additionalProperty: [
    { name: 'Shipping Weight', value: 50 },
    { name: 'Korean Benchmark Retail Price', value: 6900 },
  ]},
};
const s = compareProductSync(p)!;
console.log('=== ROI 모델 계산 (¥1.90 목도리) ===');
console.log(`도매가: ¥${s.chinaWholesaleCny} → ₩${Math.round(1.9*190)} (×190)`);
console.log(`국제운송: ₩${s.intlShippingKrw} | 관세(의류 8%): ₩${s.tariffKrw} | 랜디드코스트: ₩${s.landedCostKrw.toLocaleString()}`);
console.log(`쿠팡 판매가: ₩${s.coupangPriceKrw.toLocaleString()} − 수수료(10.8%) ₩${s.coupangFeeKrw} − 배송비 ₩${s.coupangShippingFeeKrw} = 순수익 ₩${s.netRevenueKrw.toLocaleString()}`);
console.log(`순마진: ₩${s.marginKrw.toLocaleString()} → ROI ${s.roiPercent}%`);
