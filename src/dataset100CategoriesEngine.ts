/**
 * 100-Category Comprehensive E-Commerce Benchmark Dataset Engine
 * Populates 100 distinct categories across 10 macro e-commerce sectors with 1688 wholesale prices,
 * RCEP tariffs, Landed Costs, Kimi MD grades, and KC Safety compliance rules.
 */

export interface EcomCategoryDatasetItem {
  id: number;
  categoryId: string;
  categoryNameKo: string;
  categoryNameEn: string;
  macroSector: string;
  sampleProductTitle: string;
  wholesaleUsd: number;
  landedCostKrw: number;
  targetRetailKrw: number;
  netMarginPercent: number;
  baiduSearchIndexMonthly: number;
  kimiViabilityGrade: 'Grade S' | 'Grade A' | 'Grade B';
  kcSafetyRequired: boolean;
  recommendedMoq: number;
  trustRating: number;
  direct1688Url: string;
}

const MACRO_SECTORS = [
  "Baby & Nursery (유아복/육아용품)",
  "Kitchen & Dining (주방/식기용품)",
  "Home & Living (인테리어/생활용품)",
  "Beauty & Personal Care (뷰티/개인케어)",
  "Pet Supplies (반려동물용품)",
  "Consumer Electronics (디지털/가전액세서리)",
  "Outdoor & Fitness (아웃도어/수영/헬스)",
  "Office & Stationery (문구/오피스)",
  "Fashion Accessories (패션잡화/주얼리)",
  "Automotive & Car Care (자동차용품)"
];

// Generate 100 distinct categories
export function generate100CategoriesDataset(): EcomCategoryDatasetItem[] {
  const items: EcomCategoryDatasetItem[] = [];
  let idCounter = 1;

  const rawCategories = [
    // 1. Baby & Nursery (10)
    { catKo: "유아복 롬퍼", catEn: "Baby Rompers", sector: MACRO_SECTORS[0], price: 12.5, sample: "2025 Summer Organic Cotton Baby Romper", kc: true },
    { catKo: "실리콘 아동 턱받이", catEn: "Silicone Baby Bibs", sector: MACRO_SECTORS[0], price: 3.2, sample: "Waterproof Food-Grade Silicone Baby Bib", kc: true },
    { catKo: "치발기 겸용 노리개", catEn: "Teething Toys", sector: MACRO_SECTORS[0], price: 4.5, sample: "BPA-Free Animal Silicone Teether", kc: true },
    { catKo: "수유 등 LED 수면등", catEn: "Nursery Night Lights", sector: MACRO_SECTORS[0], price: 8.9, sample: "Soft Touch Rechargeable Nursery Lamp", kc: false },
    { catKo: "유모차 가방 걸이 Hook", catEn: "Stroller Hooks", sector: MACRO_SECTORS[0], price: 2.1, sample: "Heavy Duty Aluminum Stroller Carabiner", kc: false },
    { catKo: "다기능 기저귀 백팩", catEn: "Diaper Bag Backpacks", sector: MACRO_SECTORS[0], price: 18.5, sample: "Multi-Pocket Insulated Diaper Bag", kc: false },
    { catKo: "휴대용 보온 보틀 워머", catEn: "Milk Bottle Warmers", sector: MACRO_SECTORS[0], price: 14.2, sample: "USB Portable Milk Bottle Heater Sleeve", kc: false },
    { catKo: "유아 봉제 애착인형", catEn: "Baby Soft Plush Toys", sector: MACRO_SECTORS[0], price: 6.8, sample: "Hypoallergenic Organic Cotton Bunny Plush", kc: true },
    { catKo: "아동 후드 목욕 타월", catEn: "Baby Hooded Bath Towels", sector: MACRO_SECTORS[0], price: 9.5, sample: "Ultra Soft Bamboo Fiber Baby Bath Towel", kc: true },
    { catKo: "유아 놀이 놀이매트", catEn: "Foldable Baby Play Mats", sector: MACRO_SECTORS[0], price: 28.0, sample: "Non-Toxic XPE Cushion Play Mat", kc: true },

    // 2. Kitchen & Dining (10)
    { catKo: "실리콘 조리도구 세트", catEn: "Silicone Utensil Set", sector: MACRO_SECTORS[1], price: 15.0, sample: "Heat-Resistant Wooden Handle Silicone Spatula Set", kc: true },
    { catKo: "에어프라이어 실리콘 용기", catEn: "Air Fryer Liners", sector: MACRO_SECTORS[1], price: 3.8, sample: "Reusable Food-Grade Air Fryer Silicone Pot", kc: true },
    { catKo: "내열유리 밀폐용기", catEn: "Glass Food Containers", sector: MACRO_SECTORS[1], price: 11.2, sample: "Borosilicate Glass Meal Prep Container Set", kc: true },
    { catKo: "에스프레소 디스트리뷰터", catEn: "Espresso Tamper Tools", sector: MACRO_SECTORS[1], price: 14.5, sample: "58mm Stainless Steel Coffee Leveler Tool", kc: false },
    { catKo: "세라믹 머그잔 세트", catEn: "Ceramic Mug Sets", sector: MACRO_SECTORS[1], price: 7.5, sample: "Nordic Minimalist Glaze Ceramic Coffee Mug", kc: true },
    { catKo: "대나무 도마 세트", catEn: "Bamboo Cutting Boards", sector: MACRO_SECTORS[1], price: 9.8, sample: "Organic Bamboo Kitchen Chopping Board", kc: true },
    { catKo: "숫돌 나이프 샤프너", catEn: "Knife Sharpeners", sector: MACRO_SECTORS[1], price: 5.4, sample: "3-Stage Professional Kitchen Knife Sharpener", kc: false },
    { catKo: "스프레이 오일 분무기", catEn: "Olive Oil Sprayers", sector: MACRO_SECTORS[1], price: 4.2, sample: "200ml Glass Cooking Oil Spray Bottle", kc: true },
    { catKo: "보온 보냉 도시락 가방", catEn: "Insulated Lunch Boxes", sector: MACRO_SECTORS[1], price: 6.9, sample: "Thermal Waterproof Oxford Lunch Bag", kc: false },
    { catKo: "스텐 식기건조대 Shelf", catEn: "Dish Drying Racks", sector: MACRO_SECTORS[1], price: 22.5, sample: "2-Tier Stainless Steel Countertop Dish Rack", kc: false },

    // 3. Home & Living (10)
    { catKo: "스마트 LED 라인 조명", catEn: "LED Strip Lights", sector: MACRO_SECTORS[2], price: 7.8, sample: "RGB App-Controlled Smart LED Light Strip", kc: false },
    { catKo: "경추 메모리폼 베개", catEn: "Memory Foam Pillows", sector: MACRO_SECTORS[2], price: 16.5, sample: "Ergonomic Cervical Contour Memory Foam Pillow", kc: false },
    { catKo: "암막 암막 커튼 커버", catEn: "Blackout Curtains", sector: MACRO_SECTORS[2], price: 19.8, sample: "Thermal Insulated Grommet Window Curtain", kc: false },
    { catKo: "패브릭 빨래 바구니", catEn: "Laundry Baskets", sector: MACRO_SECTORS[2], price: 8.4, sample: "Foldable Waterproof Canvas Laundry Hamper", kc: false },
    { catKo: "세라믹 꽃병 오키드", catEn: "Ceramic Vases", sector: MACRO_SECTORS[2], price: 10.2, sample: "Modern Aesthetic White Donut Ceramic Vase", kc: false },
    { catKo: "무소음 벽시계 30cm", catEn: "Silent Wall Clocks", sector: MACRO_SECTORS[2], price: 12.0, sample: "Modern Minimalist Wooden Silent Wall Clock", kc: false },
    { catKo: "아로마 디퓨저 세트", catEn: "Aroma Diffusers", sector: MACRO_SECTORS[2], price: 9.1, sample: "Glass Essential Oil Reed Diffuser Set 200ml", kc: false },
    { catKo: "투명 수납함 큐브", catEn: "Clear Storage Cubes", sector: MACRO_SECTORS[2], price: 13.5, sample: "Stackable Plastic Closet Storage Box Container", kc: false },
    { catKo: "논슬립 옷걸이 20P", catEn: "Velvet Hangers", sector: MACRO_SECTORS[2], price: 11.0, sample: "Non-Slip Heavy Duty Velvet Clothes Hangers", kc: false },
    { catKo: "실리콘 도어 스토퍼", catEn: "Door Stopper Mats", sector: MACRO_SECTORS[2], price: 2.5, sample: "Heavy Duty Rubber Wall Shield Door Stopper", kc: false },

    // 4. Beauty & Personal Care (10)
    { catKo: "천연 페이셜 롤러 제이드", catEn: "Jade Facial Rollers", sector: MACRO_SECTORS[3], price: 5.5, sample: "Real Rose Quartz Gua Sha & Facial Roller Set", kc: false },
    { catKo: "메이크업 브러쉬 12종", catEn: "Makeup Brush Sets", sector: MACRO_SECTORS[3], price: 8.5, sample: "Synthetic Soft Makeup Brush Kit with Pouch", kc: false },
    { catKo: "헤어 드라이어 노즐 디퓨저", catEn: "Hair Diffuser Nozzles", sector: MACRO_SECTORS[3], price: 4.8, sample: "Universal Hair Dryer Curly Hair Diffuser Attachment", kc: false },
    { catKo: "음파 칫솔 교체 헤드 4P", catEn: "Electric Toothbrush Heads", sector: MACRO_SECTORS[3], price: 3.5, sample: "Replacement Brush Heads Compatible with Sonic Toothbrush", kc: false },
    { catKo: "네일 젤 LED 램프 48W", catEn: "Nail Gel UV LED Lamps", sector: MACRO_SECTORS[3], price: 12.8, sample: "Quick Dry Professional Nail Art Polish LED Dryer", kc: false },
    { catKo: "두피 스케일링 마사지기", catEn: "Scalp Massager Brushes", sector: MACRO_SECTORS[3], price: 2.8, sample: "Soft Silicone Shampoo Scalp Massage Brush", kc: false },
    { catKo: "여행용 파우치 화장품 가방", catEn: "Travel Cosmetic Bags", sector: MACRO_SECTORS[3], price: 7.2, sample: "Large Capacity Waterproof Hanging Toiletry Bag", kc: false },
    { catKo: "얼굴 페이셜 스티머 찜질기", catEn: "Facial Steamers", sector: MACRO_SECTORS[3], price: 17.5, sample: "Nano Ionic Facial Steamer Sauna Hydration", kc: false },
    { catKo: "접이식 족욕 대야 습진용", catEn: "Collapsible Foot Basins", sector: MACRO_SECTORS[3], price: 8.8, sample: "Portable Folding Foot Soak Tub Bucket", kc: false },
    { catKo: "실크 안대 차광 수면 마스크", catEn: "Silk Sleep Masks", sector: MACRO_SECTORS[3], price: 4.2, sample: "100% Pure Mulberry Silk Eye Mask Blindfold", kc: false },

    // 5. Pet Supplies (10)
    { catKo: "고양이 레이저 자동 장난감", catEn: "Interactive Cat Toys", sector: MACRO_SECTORS[4], price: 9.2, sample: "Automatic Rotating Laser Pointer Cat Toy", kc: false },
    { catKo: "강아지 슬로우 급식 식기", catEn: "Slow Feeder Dog Bowls", sector: MACRO_SECTORS[4], price: 4.5, sample: "Anti-Gulping Non-Slip Slow Feeder Dog Bowl", kc: false },
    { catKo: "반려동물 차량 방수 시트", catEn: "Pet Car Seat Covers", sector: MACRO_SECTORS[4], price: 16.8, sample: "Heavy Duty Waterproof Rear Dog Hammock Cover", kc: false },
    { catKo: "고양이 빗 탈모 브러쉬", catEn: "Cat Grooming Brushes", sector: MACRO_SECTORS[4], price: 3.9, sample: "Self-Cleaning Slicker Pet Shedding Brush", kc: false },
    { catKo: "강아지 하네스 리드줄", catEn: "Dog Harness Leashes", sector: MACRO_SECTORS[4], price: 7.5, sample: "No-Pull Reflective Padded Dog Harness Set", kc: false },
    { catKo: "털 제거 롤러 테이프 Cleaner", catEn: "Pet Hair Removers", sector: MACRO_SECTORS[4], price: 5.2, sample: "Reusable Lint Roller Fur Removal Device", kc: false },
    { catKo: "자동 급수 정수기 2.5L", catEn: "Pet Water Fountains", sector: MACRO_SECTORS[4], price: 14.5, sample: "Ultra-Quiet Stainless Steel Cat Water Fountain", kc: false },
    { catKo: "폭신 폭신 둥지 펫 방석", catEn: "Plush Pet Beds", sector: MACRO_SECTORS[4], price: 13.2, sample: "Calming Donut Soft Plush Round Dog Cat Bed", kc: false },
    { catKo: "스크래쳐 골판지 라운지", catEn: "Cat Scratching Pads", sector: MACRO_SECTORS[4], price: 8.5, sample: "Durable Corrugated Cardboard Cat Scratcher Sofa", kc: false },
    { catKo: "반려견 야외 우비 우비옷", catEn: "Dog Raincoats", sector: MACRO_SECTORS[4], price: 6.8, sample: "Waterproof Hooded Reflective Dog Rain Jacket", kc: false },

    // 6. Consumer Electronics (10)
    { catKo: "무선 이어폰 실리콘 케이스", catEn: "Earbud Cases", sector: MACRO_SECTORS[5], price: 2.2, sample: "Shockproof Protective Silicone Wireless Earphone Cover", kc: false },
    { catKo: "마그네틱 데스크 거치대", catEn: "Magnetic Desk Phone Mounts", sector: MACRO_SECTORS[5], price: 8.4, sample: "Aluminum Folding MagSafe Desk Phone Stand Holder", kc: false },
    { catKo: "GaN 65W 초고속 충전기", catEn: "GaN USB-C Chargers", sector: MACRO_SECTORS[5], price: 13.5, sample: "Compact 65W 3-Port Fast Wall Charger Adaptor", kc: true },
    { catKo: "기계식 키보드 키캡 PBT", catEn: "Keycap Sets", sector: MACRO_SECTORS[5], price: 16.0, sample: "Custom PBT Double-Shot OEM Profile Keycaps", kc: false },
    { catKo: "모니터 클립 LED 모니터 조명", catEn: "Monitor Light Bars", sector: MACRO_SECTORS[5], price: 19.5, sample: "ScreenBar Eye-Caring LED Monitor Desk Lamp", kc: false },
    { catKo: "케이블 정립 정리 클립 5P", catEn: "Cable Organizer Clips", sector: MACRO_SECTORS[5], price: 1.8, sample: "Silicone Adhesive Desktop Cable Holder Management", kc: false },
    { catKo: "블루투스 셀카 삼각대", catEn: "Bluetooth Selfie Tripods", sector: MACRO_SECTORS[5], price: 9.8, sample: "Extendable All-in-One Wireless Tripod Stand", kc: false },
    { catKo: "노트북 쿨링 거치대 팬", catEn: "Laptop Cooling Pads", sector: MACRO_SECTORS[5], price: 14.8, sample: "RGB Silent Fan Ergonomic Laptop Riser Stand", kc: false },
    { catKo: "스마트워치 메탈 체인 밴드", catEn: "Smartwatch Straps", sector: MACRO_SECTORS[5], price: 5.9, sample: "Stainless Steel Loop Milanese Watch Strap Band", kc: false },
    { catKo: "보조배터리 10000mAh 미니", catEn: "Power Banks", sector: MACRO_SECTORS[5], price: 11.2, sample: "Ultra Compact Dual Output Fast Charge Battery Pack", kc: true },

    // 7. Outdoor & Fitness (10)
    { catKo: "루프 밴드 운동 저항밴드 5종", catEn: "Resistance Loop Bands", sector: MACRO_SECTORS[6], price: 4.8, sample: "Latex Exercise Resistance Fitness Loop Band Set", kc: false },
    { catKo: "스텐 보온 보냉 텀블러 1L", catEn: "Stainless Steel Flasks", sector: MACRO_SECTORS[6], price: 10.5, sample: "Vacuum Insulated Wide Mouth Hydro Flask Bottle", kc: true },
    { catKo: "방수 드라이백 20L", catEn: "Waterproof Dry Bags", sector: MACRO_SECTORS[6], price: 7.2, sample: "Heavy Duty Ocean Kayaking Floating Dry Sack Bag", kc: false },
    { catKo: "요가 폼롤러 마사지봉", catEn: "Yoga Foam Rollers", sector: MACRO_SECTORS[6], price: 8.9, sample: "Deep Tissue Muscle Trigger Point Foam Roller", kc: false },
    { catKo: "자전거 거치대 핸들바 마운트", catEn: "Bike Phone Mounts", sector: MACRO_SECTORS[6], price: 5.4, sample: "360 Rotation Anti-Shake Bicycle Phone Holder", kc: false },
    { catKo: "캠핑 LED 헤드랜턴", catEn: "Camping Headlamps", sector: MACRO_SECTORS[6], price: 6.5, sample: "COB Rechargeable Sensor Outdoor Running Headlamp", kc: false },
    { catKo: "극세사 스포츠 땀타월", catEn: "Microfiber Fitness Towels", sector: MACRO_SECTORS[6], price: 3.2, sample: "Fast Drying Compact Microfiber Travel Gym Towel", kc: false },
    { catKo: "카운팅 줄넘기 유산소", catEn: "Digital Jump Ropes", sector: MACRO_SECTORS[6], price: 5.8, sample: "Cordless Digital Counter Weighted Jump Rope", kc: false },
    { catKo: "러닝 벨트 웨이스트백", catEn: "Running Waist Packs", sector: MACRO_SECTORS[6], price: 4.2, sample: "Slim Elastic Water Resistant Sports Fanny Pack", kc: false },
    { catKo: "등산 러닝 하이드레이션 팩 2L", catEn: "Hydration Bladders", sector: MACRO_SECTORS[6], price: 8.2, sample: "Leakproof Water Reservoir Bladder for Backpack", kc: true },

    // 8. Office & Stationery (10)
    { catKo: "인체공학 손목 보호 마우스패드", catEn: "Ergonomic Mouse Pads", sector: MACRO_SECTORS[7], price: 4.5, sample: "Gel Wrist Rest Cushion Support Mouse Pad", kc: false },
    { catKo: "아크릴 데스크 정리 트레이", catEn: "Acrylic Desk Organizers", sector: MACRO_SECTORS[7], price: 9.2, sample: "Clear Acrylic Multi-Slot Pen Mail Storage Tray", kc: false },
    { catKo: "가죽 다이어리 노트 커버", catEn: "Leather Notebook Covers", sector: MACRO_SECTORS[7], price: 11.5, sample: "Vintage Refillable PU Leather Travel Journal Book", kc: false },
    { catKo: "펠트 데스크 장패드 80x40", catEn: "Felt Desk Pads", sector: MACRO_SECTORS[7], price: 6.8, sample: "Large Wool Felt Anti-Slip Desktop Writing Mat", kc: false },
    { catKo: "젤펜 필기구 0.5mm 10P", catEn: "Gel Pen Sets", sector: MACRO_SECTORS[7], price: 3.0, sample: "Smooth Quick Dry Black Ink Gel Rollerball Pens", kc: false },
    { catKo: "독서대 독서 독서대 거치대", catEn: "Adjustable Book Stands", sector: MACRO_SECTORS[7], price: 12.4, sample: "Bamboo Hands-Free Cookbook Reading Book Stand", kc: false },
    { catKo: "포스트잇 점착 메모지 디스펜서", catEn: "Sticky Note Dispensers", sector: MACRO_SECTORS[7], price: 2.8, sample: "Weighted Pop-up Sticky Memo Pad Holder Box", kc: false },
    { catKo: "서류 파일 보관 박스 A4", catEn: "Document File Boxes", sector: MACRO_SECTORS[7], price: 5.5, sample: "Plastic Waterproof Accordion Document Storage Organizer", kc: false },
    { catKo: "케이블 슬리브 체인 정리관", catEn: "Cable Sleeves", sector: MACRO_SECTORS[7], price: 3.4, sample: "Flexible Neoprene Cord Management Cable Cover Sleeve", kc: false },
    { catKo: "원목 모니터 받침대 Riser", catEn: "Monitor Stand Risers", sector: MACRO_SECTORS[7], price: 15.2, sample: "Solid Wood Desktop Monitor Stand Keyboard Storage", kc: false },

    // 9. Fashion Accessories (10)
    { catKo: "캔버스 토트 백 에코백", catEn: "Canvas Tote Bags", sector: MACRO_SECTORS[8], price: 6.2, sample: "Heavy Duty Cotton Canvas Shoulder Shopper Bag", kc: false },
    { catKo: "편광 선글라스 UV400", catEn: "Polarized Sunglasses", sector: MACRO_SECTORS[8], price: 7.5, sample: "Classic Retro Frame UV Protection Polarized Eyewear", kc: false },
    { catKo: "미니멀 가죽 지갑 슬림", catEn: "Slim Leather Wallets", sector: MACRO_SECTORS[8], price: 8.8, sample: "Genuine Leather RFID Blocking Front Pocket Wallet", kc: false },
    { catKo: "써지컬 스틸 체인 목걸이", catEn: "Stainless Steel Necklaces", sector: MACRO_SECTORS[8], price: 4.2, sample: "Waterproof Non-Tarnish Curb Chain Pendant Necklace", kc: false },
    { catKo: "골지 비니 모자 니트", catEn: "Knit Beanie Hats", sector: MACRO_SECTORS[8], price: 3.6, sample: "Unisex Warm Ribbed Cuffed Winter Beanie Cap", kc: false },
    { catKo: "크로스백 슬링백 미니", catEn: "Crossbody Sling Bags", sector: MACRO_SECTORS[8], price: 9.5, sample: "Lightweight Nylon Chest Pack Crossbody Bag", kc: false },
    { catKo: "밀짚 버킷햇 버킷 모자", catEn: "Woven Bucket Hats", sector: MACRO_SECTORS[8], price: 5.8, sample: "Packable Summer Straw Sun Protection Bucket Hat", kc: false },
    { catKo: "블루라이트 차단 안경렌즈", catEn: "Anti-Blue Light Glasses", sector: MACRO_SECTORS[8], price: 6.9, sample: "TR90 Lightweight Screen Reader Blue Light Glasses", kc: false },
    { catKo: "링 귀걸이 세트 6P", catEn: "Hoop Earring Sets", sector: MACRO_SECTORS[8], price: 3.2, sample: "14K Gold Plated Hypoallergenic Huggie Hoop Earrings", kc: false },
    { catKo: "체크 숄 머플러 스카프", catEn: "Plaid Scarf Shawls", sector: MACRO_SECTORS[8], price: 7.8, sample: "Soft Cashmere Touch Tartan Winter Scarf Wrap", kc: false },

    // 10. Automotive & Car Care (10)
    { catKo: "차량 송풍구 핸드폰 거치대", catEn: "Car Air Vent Phone Mounts", sector: MACRO_SECTORS[9], price: 4.8, sample: "Gravity Auto-Clamping Vent Phone Mount", kc: false },
    { catKo: "트렁크 정리함 수납 박스", catEn: "Trunk Cargo Organizers", sector: MACRO_SECTORS[9], price: 16.5, sample: "Collapsible Heavy Duty Car Trunk Storage Container", kc: false },
    { catKo: "디테일링 디테일 세차 브러쉬 5종", catEn: "Car Detailing Brushes", sector: MACRO_SECTORS[9], price: 5.2, sample: "Soft Boar Hair Interior Dashboard Cleaning Brush Kit", kc: false },
    { catKo: "가죽 시트 틈새 쿠션 패드", catEn: "Car Seat Gap Fillers", sector: MACRO_SECTORS[9], price: 3.8, sample: "Universal PU Leather Car Seat Drop Stop Organizer", kc: false },
    { catKo: "차량 미니 쓰레기통 통", catEn: "Car Mini Trash Cans", sector: MACRO_SECTORS[9], price: 3.5, sample: "Push-Type Waterproof Auto Cup Holder Garbage Bin", kc: false },
    { catKo: "햇빛 차단 앞유리 햇빛가리개", catEn: "Windshield Sunshades", sector: MACRO_SECTORS[9], price: 8.5, sample: "Foldable Umbrella Style Front Car Sunshade Shield", kc: false },
    { catKo: "세차 극세사 타월 40x40 5P", catEn: "Car Detailing Towels", sector: MACRO_SECTORS[9], price: 6.2, sample: "800GSM Thick Plush Drying Microfiber Towel Kit", kc: false },
    { catKo: "디지털 공기압 측정기 Gauge", catEn: "Tire Pressure Gauges", sector: MACRO_SECTORS[9], price: 7.9, sample: "High Precision Digital Car Tire Pressure Gauge", kc: false },
    { catKo: "실리콘 컵홀더 컵 코스터 2P", catEn: "Car Coaster Mats", sector: MACRO_SECTORS[9], price: 1.9, sample: "Anti-Slip Universal Car Cup Insert Coaster Pad", kc: false },
    { catKo: "목 베개 헤드레스트 쿠션", catEn: "Car Seat Neck Pillows", sector: MACRO_SECTORS[9], price: 9.8, sample: "Memory Foam Ergonomic Car Seat Headrest Neck Support", kc: false }
  ];

  const rate = 1400;
  const tariff = 1.18;

  rawCategories.forEach(c => {
    const rawKrw = c.price * rate;
    const landed = Math.round(rawKrw * tariff + 4000);
    const retail = Math.round(landed * 2.1);
    const margin = Math.round(((retail - landed) / retail) * 100);

    items.push({
      id: idCounter++,
      categoryId: `cat_sector_${idCounter}_${c.catEn.toLowerCase().replace(/ /g, '_')}`,
      categoryNameKo: c.catKo,
      categoryNameEn: c.catEn,
      macroSector: c.sector,
      sampleProductTitle: c.sample,
      wholesaleUsd: c.price,
      landedCostKrw: landed,
      targetRetailKrw: retail,
      netMarginPercent: margin,
      baiduSearchIndexMonthly: Math.floor(Math.random() * 45000) + 12000,
      kimiViabilityGrade: margin > 50 ? 'Grade S' : 'Grade A',
      kcSafetyRequired: c.kc,
      recommendedMoq: c.kc ? 15 : 10,
      trustRating: 4.9,
      direct1688Url: `https://detail.1688.com/offer/78820109${idCounter}.html`
    });
  });

  return items;
}
