const fs = require('fs');
const path = require('path');

const mockFile = path.join(__dirname, '../local_gcp_mock/postgresql/products.json');

const dataset = [
  {
    productId: "1688-romper-88201",
    title: "2025 여름 신생아 여아 순면 스플라이싱 롬퍼 아동복 수트",
    price: 12.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/8820101.html",
    scrapedAt: "2026-08-03T10:00:00.000Z",
    rawHtmlGcsUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1688-romper-88201%2Fsource.html",
    dataJsonLd: {
      "@context": {
        "@vocab": "https://schema.org/",
        "moq": "https://schema.org/eligibleQuantity",
        "factoryCity": "https://schema.org/areaServed",
        "datasetPriceSol": "https://solana.paysh/datasetPrice",
        "koreanCompetitorPrice": "https://solana.paysh/koreanRetailPrice",
        "estimatedRoi": "https://solana.paysh/estimatedRoi"
      },
      "@type": "Product",
      "@id": "urn:1688:product:1688-romper-88201",
      "name": "2025 여름 신생아 여아 순면 스플라이싱 롬퍼 아동복 수트",
      "category": "Wholesale Apparel > Rompers",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Guangzhou Direct Industrial Co., Ltd." },
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "moq": { "@type": "QuantitativeValue", "value": 5, "unitCode": "EA" }
      },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 350, "unitCode": "GRM" },
        { "name": "Material", "value": "100% Premium Cotton" },
        { "name": "Factory Location", "value": "Guangzhou" },
        { "name": "Korean Benchmark Retail Price", "value": 30590, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "52.4%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Grade A fit for Korea import. Calculated shipping weight 350g. Landed cost ~17,500 KRW vs Coupang benchmark 30,590 KRW.",
      "kimiViability": {
        "productId": "1688-romper-88201",
        "viabilityGrade": "Grade A",
        "overallScore": 88,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 8, "csReturnRiskLevel": 2, "seasonalityTiming": 8, "bundlingCrossSellPotential": 9 },
        "mdExpertOpinion": "여름 신생아 순면 롬퍼. 시즌 감성 저격 썸네일과 순면 소재로 구매전환율 높음. CS 리스크 낮음."
      }
    }
  },
  {
    productId: "1688-romper-88202",
    title: "프리미엄 100% 오가닉 코튼 민소매 유아 바디수트 롬퍼 2종 세트",
    price: 14.8,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005006240212345%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/8820202.html",
    scrapedAt: "2026-08-03T10:05:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-romper-88202",
      "name": "프리미엄 100% 오가닉 코튼 민소매 유아 바디수트 롬퍼 2종 세트",
      "category": "Wholesale Apparel > Rompers",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Shenzhen Direct Industrial Co., Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 5, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 332, "unitCode": "GRM" },
        { "name": "Material", "value": "100% Organic Cotton" },
        { "name": "Factory Location", "value": "Shenzhen" },
        { "name": "Korean Benchmark Retail Price", "value": 42110, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "61.2%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Premium organic cotton product with high margin density. Landed cost ~20,720 KRW vs Coupang benchmark 42,110 KRW.",
      "kimiViability": {
        "productId": "1688-romper-88202",
        "viabilityGrade": "Grade A+",
        "overallScore": 92,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 9, "csReturnRiskLevel": 2, "seasonalityTiming": 8, "bundlingCrossSellPotential": 9 },
        "mdExpertOpinion": "오가닉 인증 라벨 강조시 쿠팡 로켓그로스 진입 최적화. 번들링 2종 구성으로 객단가 상승 극대화."
      }
    }
  },
  {
    productId: "1688-living-99101",
    title: "북유럽 감성 모던 실리콘 유아 식기 4종 풀세트 (흡착 식판+스푼)",
    price: 8.9,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005007321459876%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910101.html",
    scrapedAt: "2026-08-03T10:10:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-living-99101",
      "name": "북유럽 감성 모던 실리콘 유아 식기 4종 풀세트 (흡착 식판+스푼)",
      "category": "Home & Kitchen > Baby Dining",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Hangzhou Direct Industrial Co., Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 5, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 280, "unitCode": "GRM" },
        { "name": "Material", "value": "BPA-Free Food Grade Silicone" },
        { "name": "Factory Location", "value": "Hangzhou" },
        { "name": "Korean Benchmark Retail Price", "value": 27412, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "78.4%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Food safety certified silicone. Landed cost ~12,460 KRW vs retail benchmark 27,412 KRW.",
      "kimiViability": {
        "productId": "1688-living-99101",
        "viabilityGrade": "Grade S",
        "overallScore": 95,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 10, "volumetricMarginDensity": 9, "csReturnRiskLevel": 1, "seasonalityTiming": 10, "bundlingCrossSellPotential": 9 },
        "mdExpertOpinion": "실리콘 식판 4종 세트. 파스텔톤 컬러감과 강력한 흡착력으로 엄마 카페 소문 추천 상품. 파손 리스크 0%."
      }
    }
  },
  {
    productId: "1688-teether-99102",
    title: "무독성 식품급 실리콘 유아 치발기 3종 입체 토이 세트",
    price: 4.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910202.html",
    scrapedAt: "2026-08-03T10:15:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-teether-99102",
      "name": "무독성 식품급 실리콘 유아 치발기 3종 입체 토이 세트",
      "category": "Toys > Baby Teether",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Yiwu Baby Toy Co., Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 10, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 140, "unitCode": "GRM" },
        { "name": "Material", "value": "100% Medical Silicone" },
        { "name": "Factory Location", "value": "Yiwu" },
        { "name": "Korean Benchmark Retail Price", "value": 18900, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "112.5%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Ultra-lightweight baby product with massive ROI density (>110%). Landed ~6,300 KRW vs retail 18,900 KRW.",
      "kimiViability": {
        "productId": "1688-teether-99102",
        "viabilityGrade": "Grade S",
        "overallScore": 96,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 10, "csReturnRiskLevel": 1, "seasonalityTiming": 10, "bundlingCrossSellPotential": 10 },
        "mdExpertOpinion": "초경량 마진 밀도 끝판왕. 배송비 부담 0에 가까움. KC 공급자적합성 시험검사 진행 필수."
      }
    }
  },
  {
    productId: "1688-shampoo-99103",
    title: "친환경 유아 저자극 샴푸앤바디워시 자동 거품 디스펜서",
    price: 9.2,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005007321459876%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910303.html",
    scrapedAt: "2026-08-03T10:20:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-shampoo-99103",
      "name": "친환경 유아 저자극 샴푸앤바디워시 자동 거품 디스펜서",
      "category": "Home & Living > Bath Accessories",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Ningbo Smart Home Tech" },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 3, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 410, "unitCode": "GRM" },
        { "name": "Material", "value": "BPA-Free ABS Plastic" },
        { "name": "Factory Location", "value": "Ningbo" },
        { "name": "Korean Benchmark Retail Price", "value": 29800, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "83.1%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] High demand smart bath gadget. Landed ~12,880 KRW vs retail 29,800 KRW.",
      "kimiViability": {
        "productId": "1688-shampoo-99103",
        "viabilityGrade": "Grade A",
        "overallScore": 87,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 8, "csReturnRiskLevel": 3, "seasonalityTiming": 8, "bundlingCrossSellPotential": 8 },
        "mdExpertOpinion": "자동 감지 모션 센서 거품기. 아이 목욕시간 흥미 유발 제품으로 30-40대 육아맘 타겟팅 추천."
      }
    }
  },
  {
    productId: "1688-towel-99104",
    title: "순면 초극세사 유아 타월 3종 패키지 (후드 비치타월 포함)",
    price: 6.8,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005006240212345%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910404.html",
    scrapedAt: "2026-08-03T10:25:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-towel-99104",
      "name": "순면 초극세사 유아 타월 3종 패키지 (후드 비치타월 포함)",
      "category": "Apparel & Home > Bath Towels",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Nantong Textile Corp." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 5, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 390, "unitCode": "GRM" },
        { "name": "Material", "value": "100% Microfiber Cotton" },
        { "name": "Factory Location", "value": "Nantong" },
        { "name": "Korean Benchmark Retail Price", "value": 22500, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "86.3%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] High absorbency cotton towel set. Landed ~9,520 KRW vs retail 22,500 KRW.",
      "kimiViability": {
        "productId": "1688-towel-99104",
        "viabilityGrade": "Grade A+",
        "overallScore": 90,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 8, "volumetricMarginDensity": 9, "csReturnRiskLevel": 1, "seasonalityTiming": 9, "bundlingCrossSellPotential": 9 },
        "mdExpertOpinion": "사계절 실생활 필수가전대체재. 후드 비치타월 귀여운 캐릭터 디자인으로 여름물놀이 시즌 판매 급증."
      }
    }
  },
  {
    productId: "1688-nightlight-99105",
    title: "스마트 감성 LED 유아 수유 무드등 (터치식 3단 무단조광)",
    price: 7.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910505.html",
    scrapedAt: "2026-08-03T10:30:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-nightlight-99105",
      "name": "스마트 감성 LED 유아 수유 무드등 (터치식 3단 무단조광)",
      "category": "Electronics > Lighting",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Zhongshan Lighting Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 4, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 290, "unitCode": "GRM" },
        { "name": "Material", "value": "Soft Silicone + ABS" },
        { "name": "Factory Location", "value": "Zhongshan" },
        { "name": "Korean Benchmark Retail Price", "value": 24900, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "89.5%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Soft lighting nursery lamp. Landed ~10,500 KRW vs retail 24,900 KRW.",
      "kimiViability": {
        "productId": "1688-nightlight-99105",
        "viabilityGrade": "Grade S",
        "overallScore": 94,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 10, "volumetricMarginDensity": 9, "csReturnRiskLevel": 2, "seasonalityTiming": 10, "bundlingCrossSellPotential": 8 },
        "mdExpertOpinion": "출산 선물용 감성 수유등. 밤 시간대 아기 눈부심 방지 실리콘 재질로 리뷰평점 4.9 예상."
      }
    }
  },
  {
    productId: "1688-yogamat-99106",
    title: "TPE 친환경 10mm 고밀도 홈트레이닝 요가매트 (미끄럼방지)",
    price: 11.2,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005007321459876%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910606.html",
    scrapedAt: "2026-08-03T10:35:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-yogamat-99106",
      "name": "TPE 친환경 10mm 고밀도 홈트레이닝 요가매트 (미끄럼방지)",
      "category": "Sports & Outdoor > Fitness",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Yiwu Sports Goods Co." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 2, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 850, "unitCode": "GRM" },
        { "name": "Material", "value": "Eco-friendly TPE" },
        { "name": "Factory Location", "value": "Yiwu" },
        { "name": "Korean Benchmark Retail Price", "value": 35000, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "73.2%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] High density home workout mat. Landed ~15,680 KRW vs retail 35,000 KRW.",
      "kimiViability": {
        "productId": "1688-yogamat-99106",
        "viabilityGrade": "Grade A",
        "overallScore": 86,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 8, "volumetricMarginDensity": 7, "csReturnRiskLevel": 2, "seasonalityTiming": 9, "bundlingCrossSellPotential": 8 },
        "mdExpertOpinion": "10mm 두께감으로 층간소음 방지 어필. 홈트족 스테디셀러."
      }
    }
  },
  {
    productId: "1688-snack-99107",
    title: "유기농 아기 쌀과자 보관용 100% 무독성 실리콘 스낵 컨테이너",
    price: 3.8,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005006240212345%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910707.html",
    scrapedAt: "2026-08-03T10:40:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-snack-99107",
      "name": "유기농 아기 쌀과자 보관용 100% 무독성 실리콘 스낵 컨테이너",
      "category": "Home & Kitchen > Baby Dining",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Guangzhou Silicone Products" },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 10, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 120, "unitCode": "GRM" },
        { "name": "Material", "value": "100% Platinum Silicone" },
        { "name": "Factory Location", "value": "Guangzhou" },
        { "name": "Korean Benchmark Retail Price", "value": 15900, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "128.4%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Ultra-compact food-grade snack cup with over 120% margin. Landed ~5,320 KRW vs retail 15,900 KRW.",
      "kimiViability": {
        "productId": "1688-snack-99107",
        "viabilityGrade": "Grade S",
        "overallScore": 97,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 10, "csReturnRiskLevel": 1, "seasonalityTiming": 10, "bundlingCrossSellPotential": 10 },
        "mdExpertOpinion": "외출 필수 유아 스낵컵. 쏟아짐 방지 꽃모양 실리콘 날개 디자인. 높은 합배송 추가구매율."
      }
    }
  },
  {
    productId: "1688-fan-99108",
    title: "탁상용 무선 미니 저소음 서큘레이터 선풍기 (USB-C 충전식)",
    price: 13.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910808.html",
    scrapedAt: "2026-08-03T10:45:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-fan-99108",
      "name": "탁상용 무선 미니 저소음 서큘레이터 선풍기 (USB-C 충전식)",
      "category": "Electronics > Small Appliances",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Shenzhen Tech Appliance Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 3, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 480, "unitCode": "GRM" },
        { "name": "Material", "value": "ABS + Brushless DC Motor" },
        { "name": "Factory Location", "value": "Shenzhen" },
        { "name": "Korean Benchmark Retail Price", "value": 39900, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "69.3%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Low-noise wireless fan with BLDC motor. Landed ~18,900 KRW vs retail 39,900 KRW.",
      "kimiViability": {
        "productId": "1688-fan-99108",
        "viabilityGrade": "Grade A",
        "overallScore": 89,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 8, "csReturnRiskLevel": 3, "seasonalityTiming": 10, "bundlingCrossSellPotential": 7 },
        "mdExpertOpinion": "여름 시즌 데스크탑 필수품. BLDC 저소음 모터 어필로 오피스 직장인 및 독서실 학생층 타겟팅."
      }
    }
  },
  {
    productId: "1688-diaperbag-99109",
    title: "대용량 방수 보온/보냉 스마트 기저귀 백팩 (유모차 걸이 포함)",
    price: 18.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005007321459876%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/9910909.html",
    scrapedAt: "2026-08-03T10:50:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-diaperbag-99109",
      "name": "대용량 방수 보온/보냉 스마트 기저귀 백팩 (유모차 걸이 포함)",
      "category": "Bags & Luggage > Baby Bags",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Quanzhou Bag Manufacturing Co." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 2, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 720, "unitCode": "GRM" },
        { "name": "Material", "value": "Waterproof Oxford Fabric" },
        { "name": "Factory Location", "value": "Quanzhou" },
        { "name": "Korean Benchmark Retail Price", "value": 59000, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "78.2%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Multi-pocket insulated diaper backpack. Landed ~25,900 KRW vs retail 59,000 KRW.",
      "kimiViability": {
        "productId": "1688-diaperbag-99109",
        "viabilityGrade": "Grade A+",
        "overallScore": 91,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 8, "csReturnRiskLevel": 2, "seasonalityTiming": 9, "bundlingCrossSellPotential": 9 },
        "mdExpertOpinion": "방수 포켓, 보온 보충제 주머니 등 압도적 수납력. 유모차 걸이 스트랩 기본 제공으로 실용성 최고."
      }
    }
  },
  {
    productId: "1688-petfeeder-77302",
    title: "스마트 자동 펫 피더 급식기 (음성녹음/스마트앱 연동)",
    price: 24.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005006240212345%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/7730202.html",
    scrapedAt: "2026-08-03T10:55:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-petfeeder-77302",
      "name": "스마트 자동 펫 피더 급식기 (음성녹음/스마트앱 연동)",
      "category": "Pet Supplies > Automatic Feeders",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Shenzhen PetTech Solutions" },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 2, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 1250, "unitCode": "GRM" },
        { "name": "Material", "value": "Food Grade ABS + Stainless Bowl" },
        { "name": "Factory Location", "value": "Shenzhen" },
        { "name": "Korean Benchmark Retail Price", "value": 78000, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "81.6%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Smart IoT pet feeder for dogs and cats. Landed ~34,300 KRW vs retail 78,000 KRW.",
      "kimiViability": {
        "productId": "1688-petfeeder-77302",
        "viabilityGrade": "Grade S",
        "overallScore": 93,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 8, "csReturnRiskLevel": 2, "seasonalityTiming": 10, "bundlingCrossSellPotential": 9 },
        "mdExpertOpinion": "한국 1인 가구 펫족 폭증 트렌드 최적화. 1688 도매가 24.5불로 국내 시가 7.8만 원 판매 가능."
      }
    }
  },
  {
    productId: "1688-blender-77303",
    title: "휴대용 무선 6날 미니 초고속 믹서기 텀블러 (C타입 충전)",
    price: 14.2,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/7730303.html",
    scrapedAt: "2026-08-03T11:00:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-blender-77303",
      "name": "휴대용 무선 6날 미니 초고속 믹서기 텀블러 (C타입 충전)",
      "category": "Electronics > Kitchen Gadgets",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Foshan Electric Co." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 3, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 520, "unitCode": "GRM" },
        { "name": "Material", "value": "Tritan BPA Free + 304 Stainless Steel" },
        { "name": "Factory Location", "value": "Foshan" },
        { "name": "Korean Benchmark Retail Price", "value": 45000, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "79.8%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] 6-blade portable blender tumbler. Landed ~19,880 KRW vs retail 45,000 KRW.",
      "kimiViability": {
        "productId": "1688-blender-77303",
        "viabilityGrade": "Grade A",
        "overallScore": 88,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 8, "csReturnRiskLevel": 3, "seasonalityTiming": 9, "bundlingCrossSellPotential": 8 },
        "mdExpertOpinion": "다이어트 주스/단백질 쉐이크용 휴대용 텀블러 믹서기. 세척 용이성과 트라이탄 안전소재 어필."
      }
    }
  },
  {
    productId: "1688-tech-77301",
    title: "초소형 휴대용 음이온 유아 수면 공기청정기 (USB 충전식)",
    price: 16.5,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005008543210123%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/7730101.html",
    scrapedAt: "2026-08-03T11:05:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-tech-77301",
      "name": "초소형 휴대용 음이온 유아 수면 공기청정기 (USB 충전식)",
      "category": "Electronics > Air Purifiers",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Hangzhou Direct Industrial Co., Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 2, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 539, "unitCode": "GRM" },
        { "name": "Material", "value": "ABS + HEPA Filter" },
        { "name": "Factory Location", "value": "Hangzhou" },
        { "name": "Korean Benchmark Retail Price", "value": 47314, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "63.2%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] Ultra-silent baby sleep air purifier. Landed ~23,100 KRW vs retail 47,314 KRW.",
      "kimiViability": {
        "productId": "1688-tech-77301",
        "viabilityGrade": "Grade A",
        "overallScore": 86,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 9, "volumetricMarginDensity": 7, "csReturnRiskLevel": 3, "seasonalityTiming": 8, "bundlingCrossSellPotential": 8 },
        "mdExpertOpinion": "유아 침실 및 차 안에서 사용할 수 있는 음이온 수면 공기청정기. 부모님들의 신뢰도 유발."
      }
    }
  },
  {
    productId: "1688-chair-77304",
    title: "인체공학 메쉬 요추지지 사무용 게이밍 의자 (헤드레스트 포함)",
    price: 38.0,
    currency: "USD",
    imageUrl: "https://storage.googleapis.com/scraped-data-bucket-solana-503111/products%2F1005007321459876%2Fimage.jpg",
    sourceUrl: "https://detail.1688.com/offer/7730404.html",
    scrapedAt: "2026-08-03T11:10:00.000Z",
    dataJsonLd: {
      "@type": "Product",
      "@id": "urn:1688:product:1688-chair-77304",
      "name": "인체공학 메쉬 요추지지 사무용 게이밍 의자 (헤드레스트 포함)",
      "category": "Furniture > Office Chairs",
      "datasetPriceSol": 0.01,
      "brand": { "@type": "Brand", "name": "Anji Furniture Co., Ltd." },
      "offers": { "@type": "AggregateOffer", "moq": { "value": 1, "unitCode": "EA" } },
      "additionalProperty": [
        { "name": "Shipping Weight", "value": 4500, "unitCode": "GRM" },
        { "name": "Material", "value": "Breathable Mesh + Steel Frame" },
        { "name": "Factory Location", "value": "Anji" },
        { "name": "Korean Benchmark Retail Price", "value": 129000, "unitCode": "KRW" },
        { "name": "Estimated ROI Margin", "value": "78.9%" }
      ],
      "viabilitySummary": "[AI Agent Analysis] High-margin ergonomic mesh office chair. Heavy cargo freight calculated. Landed ~53,200 KRW vs retail 129,000 KRW.",
      "kimiViability": {
        "productId": "1688-chair-77304",
        "viabilityGrade": "Grade A",
        "overallScore": 89,
        "tacitKnowledgeScores": { "visualThumbnailAppeal": 8, "volumetricMarginDensity": 6, "csReturnRiskLevel": 3, "seasonalityTiming": 8, "bundlingCrossSellPotential": 7 },
        "mdExpertOpinion": "안지(Anji) 의자 단지 직송. 중량화물 배송비(약 8,000원) 감안하더라도 시중 12.9만원선 대비 5.3만원 원가로 큰 순수익 마진 창출 가능."
      }
    }
  }
];

fs.writeFileSync(mockFile, JSON.stringify(dataset, null, 2), 'utf-8');
console.log(`Successfully seeded ${dataset.length} rich items into ${mockFile}`);
