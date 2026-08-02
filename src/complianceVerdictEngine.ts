/**
 * SEONDAL // Regulatory Compliance Verdict Engine (규제 가부 판정 엔진)
 *
 * Core Scenario: 1688 product spec → Korean regulatory mapping → 🟢/🟡/🔴 verdict
 *
 * Design Principles:
 * 1. DETERMINISTIC: Regulation mapping is rule-based. An LLM must NEVER
 *    hallucinate legal requirements. (LLMs may assist attribute extraction
 *    from noisy Chinese web text upstream, but the law mapping here is fixed code.)
 * 2. AGENCY ROUTING: Each requirement names its governing body
 *    (국가기술표준원 / 방송통신위원회 / 식품의약품안전처 / 관세청).
 * 3. BEGINNER-FIRST: Verdicts account for a ₩3M seed budget reality —
 *    a product can be technically certifiable but still 🔴 for a beginner.
 * 4. AUDIT TRAIL: Every extracted attribute records the matched keyword signal.
 *
 * NOTE: Cost/time figures are conservative public-estimate ranges (시험기관 견적에 따라 변동).
 * They are decision aids for beginners, NOT legal advice (법률 자문 아님).
 */

// ============================================================================
// Types
// ============================================================================

export type VerdictColor = 'GREEN' | 'YELLOW' | 'RED';

export type Agency =
  | '국가기술표준원'
  | '방송통신위원회(국립전파연구원)'
  | '식품의약품안전처'
  | '관세청';

export type RequirementType =
  | 'SAFETY_CERT'              // 안전인증 (가장 무거움)
  | 'SAFETY_CONFIRM'           // 안전확인
  | 'SUPPLIER_DECLARATION'     // 공급자적합성확인
  | 'RADIO_CONFORMITY'         // 전파 적합성평가
  | 'FOOD_IMPORT_DECLARATION'  // 식품위생법 수입신고
  | 'TRANSPORT_REG'            // 운송 규제 (리튬배터리 등)
  | 'LABELING';                // 표시사항 (원산지 등)

export interface ProductRegulatoryAttributes {
  isChildrenProduct: boolean;        // 만 13세 이하 사용 대상
  declaredAgeMinYears: number | null; // 상품 표기 연령 (예: "14세 이상" → 14)
  isToy: boolean;
  isSlimeOrPutty: boolean;           // 유핵물질 고위험 완구군
  isElectrical: boolean;
  operatingVoltageV: number | null;
  batteryType: 'NONE' | 'LITHIUM' | 'DRY' | 'UNKNOWN';
  hasWirelessRadio: boolean;         // 블루투스 / Wi-Fi / RF
  wirelessProtocols: string[];
  isFoodContact: boolean;
  foodContactMaterials: string[];
  matchedSignals: string[];          // 어떤 키워드가 매칭됐는지 감사 추적
}

export interface ComplianceRequirement {
  ruleId: string;
  lawName: string;
  agency: Agency;
  requirementType: RequirementType;
  requirementName: string;
  estimatedCostKrw: { min: number; max: number };
  estimatedWeeks: { min: number; max: number };
  requiredDocuments: string[];
  beginnerRiskNote: string;
  severity: 'INFO' | 'CONDITIONAL' | 'BLOCKING_HIGH';
}

export interface ComplianceVerdict {
  productTitle: string;
  attributes: ProductRegulatoryAttributes;
  verdict: VerdictColor;
  verdictLabel: string;
  agenciesInvolved: Agency[];
  requirements: ComplianceRequirement[];
  totalEstimatedCostKrw: { min: number; max: number };
  totalEstimatedWeeks: { min: number; max: number };
  reasoningChain: string[];
}

// ============================================================================
// 1. Attribute Extraction (키워드 신호 기반 — LLM 교체 가능 지점)
// ============================================================================

const KW = {
  children: ['儿童', '宝宝', '婴儿', '婴幼儿', '小孩', '유아', '어린이', '아동', '키즈', '아기', 'kids', 'baby', 'infant', 'toddler', '신생아', '초등'],
  toy: ['玩具', '장난감', '완구', 'toy', 'ブ릭', '레고호환', '피겨놀이', '인형놀이'],
  slime: ['slime', '슬라임', '水晶泥', '史莱姆', '말랑이', '퍼티', 'putty', '점토', '粘土', '彩泥'],
  adultDeclared: ['14岁以上', '14세 이상', '만 14세', '15岁以上', '18禁', '성인용', 'ages 14+'],
  collectibleDecor: ['摆件', '手办', '장식', '인테리어 소품', '피규어 장식', 'decor', 'ornament'],
  electrical: ['灯', 'LED', '전기', '충전기', '플러그', '电源', '电器', '가전', '램프', '조명', '风扇', '선풍기', '히터', '电热'],
  wireless: ['蓝牙', '블루투스', 'bluetooth', 'wifi', 'wi-fi', '无线', '무선', '遥控', '리모컨', '2.4g', 'RF'],
  batteryLithium: ['锂电池', '리튬', 'lithium', '充电款', '충전식', '内置电池', '보조배터리', '移动电源', 'powerbank', 'power bank'],
  batteryDry: ['干电池', '건전지', 'AA电池', 'AAA电池', '알칼라인'],
  powerBank: ['보조배터리', '移动电源', 'powerbank', 'power bank', '充电宝'],
  foodContact: ['餐具', '식기', '碗', '접시', '그릇', '텀블러', '물병', '水杯', '杯子', '도시락', 'lunch box', '饭盒', '食品级', '식품등급', 'food grade', '辅食', '이유식', '컵', '머그', 'mug', '젓가락', '筷子', '숟가락', '勺', '锅', '냄비', '프라이팬', '조리도구', '厨具', '실리콘 스파츌라', '菜板', '도마'],
  foodContactExclusion: ['置物架', '收纳', '수납', '선반', '랙', 'rack', '沥水架', '홀더', '정리대'],
  silicone: ['硅胶', '실리콘', 'silicone'],
  stainless: ['不锈钢', '스테인리스', 'stainless', '304', '316'],
  ceramic: ['陶瓷', '세라믹', '도자기', 'ceramic'],
  plasticPP: ['PP材质', 'PP재질', '폴리프로필렌', 'pp'],
  glass: ['玻璃', '유리', 'glass'],
};

function containsAny(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k.toLowerCase()));
}

function extractDeclaredAge(text: string): number | null {
  const patterns = [
    /(\d{1,2})\s*岁以上/,          // 3岁以上
    /(\d{1,2})\s*세\s*이상/,        // 3세 이상
    /만\s*(\d{1,2})\s*세/,          // 만 3세
    /ages?\s*(\d{1,2})\s*\+/i,      // ages 3+
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function extractVoltage(text: string): number | null {
  const m = text.match(/(\d{2,3})\s*[vV](?![a-zA-Z])/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extracts regulation-relevant attributes from raw product text (zh/ko/en mixed).
 * Upstream LLM extraction can replace this later — the signature is the contract.
 */
export function extractRegulatoryAttributes(title: string, extraText = ''): ProductRegulatoryAttributes {
  const text = `${title} ${extraText}`;
  const signals: string[] = [];
  const hit = (label: string, matches: string[]) => {
    if (matches.length > 0) signals.push(`${label}: [${matches.join(', ')}]`);
    return matches.length > 0;
  };

  const declaredAge = extractDeclaredAge(text);
  const adultDeclared = hit('성인대상표기', containsAny(text, KW.adultDeclared)) || (declaredAge !== null && declaredAge >= 14);
  const childrenHit = hit('어린이키워드', containsAny(text, KW.children));
  const isChildrenProduct = !adultDeclared && (childrenHit || (declaredAge !== null && declaredAge < 14));

  const toyHit = hit('완구키워드', containsAny(text, KW.toy));
  const decorOnly = hit('장식용키워드', containsAny(text, KW.collectibleDecor)) && !toyHit;
  const isToy = isChildrenProduct && toyHit && !decorOnly;
  const isSlimeOrPutty = hit('슬라임류', containsAny(text, KW.slime));

  const isElectrical = hit('전기제품', containsAny(text, KW.electrical));
  const wirelessMatches = containsAny(text, KW.wireless);
  const hasWirelessRadio = hit('무선기능', wirelessMatches);
  const voltage = extractVoltage(text);

  const lithium = hit('리튬배터리', containsAny(text, KW.batteryLithium));
  const dry = hit('건전지', containsAny(text, KW.batteryDry));
  const batteryType: ProductRegulatoryAttributes['batteryType'] = lithium ? 'LITHIUM' : dry ? 'DRY' : 'NONE';

  const exclusionHit = containsAny(text, KW.foodContactExclusion).length > 0;
  const foodHit = containsAny(text, KW.foodContact);
  const isFoodContact = hit('식품접촉', foodHit) && !(exclusionHit && foodHit.length === 0);

  const materials: string[] = [];
  if (containsAny(text, KW.silicone).length) materials.push('실리콘');
  if (containsAny(text, KW.stainless).length) materials.push('스테인리스');
  if (containsAny(text, KW.ceramic).length) materials.push('세라믹/도자기');
  if (containsAny(text, KW.plasticPP).length) materials.push('PP 플라스틱');
  if (containsAny(text, KW.glass).length) materials.push('유리');
  if (materials.length && isFoodContact) signals.push(`식품접촉재질: [${materials.join(', ')}]`);

  return {
    isChildrenProduct,
    declaredAgeMinYears: declaredAge,
    isToy,
    isSlimeOrPutty,
    isElectrical,
    operatingVoltageV: voltage,
    batteryType,
    hasWirelessRadio,
    wirelessProtocols: wirelessMatches,
    isFoodContact,
    foodContactMaterials: materials,
    matchedSignals: signals,
  };
}

// ============================================================================
// 2. Regulation Rule Knowledge Base (법령 → 요건 매핑, 결정론적)
// ============================================================================

interface RegulationRule {
  ruleId: string;
  lawName: string;
  agency: Agency;
  requirementType: RequirementType;
  requirementName: string;
  appliesWhen: (a: ProductRegulatoryAttributes) => boolean;
  estimatedCostKrw: { min: number; max: number };
  estimatedWeeks: { min: number; max: number };
  requiredDocuments: string[];
  beginnerRiskNote: string;
  severity: 'INFO' | 'CONDITIONAL' | 'BLOCKING_HIGH';
}

const REGULATION_RULES: RegulationRule[] = [
  {
    ruleId: 'CHILD_TOY_SAFETY_CERT',
    lawName: '어린이제품의 안전 특별법',
    agency: '국가기술표준원',
    requirementType: 'SAFETY_CERT',
    requirementName: 'KC 안전인증 (어린이 완구)',
    appliesWhen: (a) => a.isChildrenProduct && a.isToy,
    estimatedCostKrw: { min: 1_000_000, max: 3_000_000 },
    estimatedWeeks: { min: 4, max: 8 },
    requiredDocuments: [
      '지정 시험기관(KCL, KTC 등) 안전인증 시험성적서',
      '물리적 안전 + 유핵물질(프탈레이트, 납 등) 시험 통과',
      'KC 마크 및 연령 표시 부착',
    ],
    beginnerRiskNote: '모델별 인증 비용이 수백만 원 단위. 초기 자본 ₩3M 기준 단일 품목 인증에 예산 전부가 소모될 수 있음.',
    severity: 'CONDITIONAL',
  },
  {
    ruleId: 'SLIME_CHEMICAL_HAZARD',
    lawName: '어린이제품의 안전 특별법 + 화학물질 규제',
    agency: '국가기술표준원',
    requirementType: 'SAFETY_CERT',
    requirementName: '슬라임류 유핵물질 고위험 경고',
    appliesWhen: (a) => a.isChildrenProduct && a.isSlimeOrPutty,
    estimatedCostKrw: { min: 0, max: 0 },
    estimatedWeeks: { min: 0, max: 0 },
    requiredDocuments: ['붕산·방부제(CMIT/MIT) 성분 시험 필수'],
    beginnerRiskNote: '슬라임/말랑이류는 붕산 초과·방부제 검출로 리콜·폐기 사례가 반복된 최고위험군. 초보 셀러 첫 사입 품목으로 강력 비추천.',
    severity: 'BLOCKING_HIGH',
  },
  {
    ruleId: 'RADIO_CONFORMITY',
    lawName: '전파법 (방송통신기자재 등의 적합성평가)',
    agency: '방송통신위원회(국립전파연구원)',
    requirementType: 'RADIO_CONFORMITY',
    requirementName: '전파 적합성평가 (무선기기 적합등록/인증)',
    appliesWhen: (a) => a.hasWirelessRadio,
    estimatedCostKrw: { min: 1_500_000, max: 3_000_000 },
    estimatedWeeks: { min: 3, max: 6 },
    requiredDocuments: [
      'RRA 지정시험기관 전파 시험성적서',
      '적합성평가 신고 및 KC 전파 마크 표시',
      '(해외 시험성적서 보유 시 비용 절감 가능)',
    ],
    beginnerRiskNote: '블루투스/Wi-Fi 하나 들어가면 무조건 걸리는 규제. KC 인증만 알고 전파인증을 놓치는 게 초보 최다 실수.',
    severity: 'CONDITIONAL',
  },
  {
    ruleId: 'ELEC_SAFETY_CONFIRM',
    lawName: '전기용품 및 생활용품 안전관리법 (전안법)',
    agency: '국가기술표준원',
    requirementType: 'SAFETY_CONFIRM',
    requirementName: 'KC 전기안전 (안전인증/안전확인)',
    appliesWhen: (a) => a.isElectrical && a.operatingVoltageV !== null && a.operatingVoltageV >= 30,
    estimatedCostKrw: { min: 1_000_000, max: 2_000_000 },
    estimatedWeeks: { min: 4, max: 6 },
    requiredDocuments: ['전기안전 시험성적서', '안전관리법상 표시사항 부착'],
    beginnerRiskNote: 'AC 전원 또는 DC 42V/AC 30V 이상 전기제품은 전안법 대상. 저전압(5V USB 등)은 비적용.',
    severity: 'CONDITIONAL',
  },
  {
    ruleId: 'ELEC_VOLTAGE_CHECK',
    lawName: '전기용품 및 생활용품 안전관리법 (전안법)',
    agency: '국가기술표준원',
    requirementType: 'SUPPLIER_DECLARATION',
    requirementName: '전압 스펙 확인 필요 (전안법 적용 여부 판별)',
    appliesWhen: (a) => a.isElectrical && a.operatingVoltageV === null,
    estimatedCostKrw: { min: 0, max: 0 },
    estimatedWeeks: { min: 0, max: 0 },
    requiredDocuments: ['제조사 스펙시트 (정격전압 확인)'],
    beginnerRiskNote: '상세페이지에 전압 표기가 없음. 30V 미만이면 전안법 비적용, 이상이면 인증 대상 — 반드시 공급처에 확인.',
    severity: 'INFO',
  },
  {
    ruleId: 'LITHIUM_TRANSPORT',
    lawName: '항공위험물 운송 규정 (IATA DGR / UN38.3)',
    agency: '관세청',
    requirementType: 'TRANSPORT_REG',
    requirementName: '리튬배터리 운송 규제',
    appliesWhen: (a) => a.batteryType === 'LITHIUM',
    estimatedCostKrw: { min: 0, max: 100_000 },
    estimatedWeeks: { min: 0, max: 1 },
    requiredDocuments: ['UN38.3 시험 요약서 (공급처 요청)', 'MSDS'],
    beginnerRiskNote: '항공 특송이 제한될 수 있어 리드타임이 길어짐. 해상 운송 전환 검토 필요.',
    severity: 'INFO',
  },
  {
    ruleId: 'FOOD_CONTACT_IMPORT',
    lawName: '식품위생법 (기구 및 용기·포장)',
    agency: '식품의약품안전처',
    requirementType: 'FOOD_IMPORT_DECLARATION',
    requirementName: '식품접촉 기구·용기포장 수입신고',
    appliesWhen: (a) => a.isFoodContact,
    estimatedCostKrw: { min: 200_000, max: 800_000 },
    estimatedWeeks: { min: 1, max: 3 },
    requiredDocuments: [
      '식약처 수입신고 (통관 시)',
      '재질별 규격시험 성적 (납·카드뮴 용출, 재질 기준)',
      '한글 표시사항 (재질, 내열온도, 수입자명 등)',
    ],
    beginnerRiskNote: 'KC가 아니라 식약처 관할이라는 것을 모르는 초보가 많음. 재질(실리콘/플라스틱)이 다양하면 시험 항목이 늘어 비용 증가.',
    severity: 'CONDITIONAL',
  },
  {
    ruleId: 'CHILD_FOOD_CONTACT_STRICT',
    lawName: '식품위생법 (영유아용 기구 기준 강화)',
    agency: '식품의약품안전처',
    requirementType: 'FOOD_IMPORT_DECLARATION',
    requirementName: '영유아용 식품접촉 제품 기준 강화 적용',
    appliesWhen: (a) => a.isFoodContact && a.isChildrenProduct,
    estimatedCostKrw: { min: 100_000, max: 300_000 },
    estimatedWeeks: { min: 0, max: 1 },
    requiredDocuments: ['영유아용 기구·용기 강화 기준 시험 항목 추가'],
    beginnerRiskNote: '영유아용은 일반 기구보다 기준이 엄격. "이유식", "아기 식기" 표기가 있으면 강화 기준 적용.',
    severity: 'INFO',
  },
  {
    ruleId: 'ORIGIN_LABELING',
    lawName: '대외무역법 / 관세법 (원산지 표시)',
    agency: '관세청',
    requirementType: 'LABELING',
    requirementName: '원산지 표시 (MADE IN CHINA) 및 수입자 표시',
    appliesWhen: () => true,
    estimatedCostKrw: { min: 0, max: 0 },
    estimatedWeeks: { min: 0, max: 0 },
    requiredDocuments: ['제품 또는 포장에 원산지 표시', '수입자 상호·주소 표시'],
    beginnerRiskNote: '모든 수입품 공통. 표시 누락 시 과태료 대상이지만 비용은 거의 없음.',
    severity: 'INFO',
  },
];

// ============================================================================
// 3. Verdict Synthesis
// ============================================================================

const VERDICT_LABELS: Record<VerdictColor, string> = {
  GREEN: '🟢 바로 판매 가능 (표시사항만 준수)',
  YELLOW: '🟡 인증·신고 후 판매 가능 (비용·기간 확인 필요)',
  RED: '🔴 초보 비추천 (규제 리스크 과다)',
};

export function assessProductCompliance(title: string, extraText = ''): ComplianceVerdict {
  const attributes = extractRegulatoryAttributes(title, extraText);

  const firedRules = REGULATION_RULES.filter(r => r.appliesWhen(attributes));
  const requirements: ComplianceRequirement[] = firedRules.map(r => ({
    ruleId: r.ruleId,
    lawName: r.lawName,
    agency: r.agency,
    requirementType: r.requirementType,
    requirementName: r.requirementName,
    estimatedCostKrw: r.estimatedCostKrw,
    estimatedWeeks: r.estimatedWeeks,
    requiredDocuments: r.requiredDocuments,
    beginnerRiskNote: r.beginnerRiskNote,
    severity: r.severity,
  }));

  let verdict: VerdictColor = 'GREEN';
  if (requirements.some(r => r.severity === 'BLOCKING_HIGH')) {
    verdict = 'RED';
  } else if (requirements.some(r => r.severity === 'CONDITIONAL')) {
    verdict = 'YELLOW';
  }

  const agencies = [...new Set(
    requirements.filter(r => r.severity !== 'INFO').map(r => r.agency)
  )];

  const costMin = requirements.reduce((s, r) => s + r.estimatedCostKrw.min, 0);
  const costMax = requirements.reduce((s, r) => s + r.estimatedCostKrw.max, 0);
  const weeksMin = requirements.length ? Math.max(0, ...requirements.map(r => r.estimatedWeeks.min)) : 0;
  const weeksMax = requirements.length ? Math.max(0, ...requirements.map(r => r.estimatedWeeks.max)) : 0;

  const reasoningChain: string[] = [
    `1. 속성 추출: ${attributes.matchedSignals.length ? attributes.matchedSignals.join(' | ') : '규제 신호 없음'}`,
    `2. 규칙 매칭: ${firedRules.length}개 규칙 발화 → ${firedRules.map(r => r.ruleId).join(', ')}`,
    `3. 기관 라우팅: ${agencies.length ? agencies.join(' + ') : '해당 기관 없음 (관세청 표시사항만)'}`,
    `4. 최종 판정: ${VERDICT_LABELS[verdict]}`,
  ];

  return {
    productTitle: title,
    attributes,
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    agenciesInvolved: agencies,
    requirements,
    totalEstimatedCostKrw: { min: costMin, max: costMax },
    totalEstimatedWeeks: { min: weeksMin, max: weeksMax },
    reasoningChain,
  };
}
