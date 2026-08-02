/**
 * categoryCatalog.ts — Cross-border (China→Korea) category knowledge base.
 *
 * Each category carries the signals a beginner actually needs:
 *   - beginnerFit:  can a first-timer survive here? (regulation/scam/return risk)
 *   - koreaDemand:  how hot is it in Korea right now (1-5)
 *   - chinaSupply:  how easily 1688/Taobao supplies it (1-5)
 *   - marginBand:   typical ROI band observed in cross-border resale
 *   - regulation:   what blocks you at customs/KC (empty = clean)
 */

export interface CategoryMeta {
  id: string;
  name: string;
  keywords: string[];          // matched against product titles for classification
  beginnerFit: 'easy' | 'medium' | 'hard' | 'avoid';
  koreaDemand: 1 | 2 | 3 | 4 | 5;
  chinaSupply: 1 | 2 | 3 | 4 | 5;
  marginBand: [number, number]; // typical ROI %
  regulation: string;
  why: string;
}

export const CATEGORY_CATALOG: CategoryMeta[] = [
  {
    id: 'baby-apparel', name: '유아 의류 (롬퍼/속싸개)',
    keywords: ['롬퍼', 'romper', '유아복', '아동복', '속싸개', '아기옷', '손수건', '턱받이', '양말'],
    beginnerFit: 'easy', koreaDemand: 5, chinaSupply: 5, marginBand: [40, 75],
    regulation: '36개월 이하 KC (공급자 적합성 성적서)',
    why: '회전 빠름·리스크 낮음. 초보 표준 진입 카테고리.',
  },
  {
    id: 'baby-tableware', name: '유아 식기 (실리콘)',
    keywords: ['식기', '실리콘', '식판', '스푼', '컵', '빨대컵'],
    beginnerFit: 'easy', koreaDemand: 4, chinaSupply: 5, marginBand: [50, 85],
    regulation: '식품위생법 수입신고 (성적서 구비 시 통관 묂)',
    why: '마진 밀도 높고 반품 적음. 유아복과 묶음 판매 궁합.',
  },
  {
    id: 'toys', name: '완구/교구',
    keywords: ['완구', '장난감', '교구', '모빌', '치발기', '블록'],
    beginnerFit: 'medium', koreaDemand: 4, chinaSupply: 5, marginBand: [45, 80],
    regulation: '어린이제품 특별안전법 안전확인 대상',
    why: 'KC 서류만 챙기면 고마진. 전자 완구는 hard로 분류.',
  },
  {
    id: 'pet', name: '반려동물 용품',
    keywords: ['강아지', '고양이', '반려', 'pet', '하네스', '리드줄', '급식'],
    beginnerFit: 'easy', koreaDemand: 5, chinaSupply: 5, marginBand: [55, 95],
    regulation: '',
    why: '규제 거의 없음 + 한국 펫 인구 폭증. 초보에게 가장 안전한 고마진.',
  },
  {
    id: 'home-kitchen', name: '홈/주방 소품',
    keywords: ['주방', '수납', '정리', '홈', '인테리어', '실리콘 매트', '용기'],
    beginnerFit: 'easy', koreaDemand: 4, chinaSupply: 5, marginBand: [60, 120],
    regulation: '',
    why: '마진 밀도 최상급(가볍고 부피 작음). 트렌드 회전 빠름.',
  },
  {
    id: 'beauty-tools', name: '뷰티 도구 (화장품 제외)',
    keywords: ['뷰티', '롤러', '브러시', '마사지', '거울', '헤어'],
    beginnerFit: 'medium', koreaDemand: 4, chinaSupply: 4, marginBand: [70, 150],
    regulation: '화장품으로 오분류 주의 (도구는 무규제)',
    why: '마진은 최고지만 트렌드 사이클 짧음. 소량 회전 전략.',
  },
  {
    id: 'camping', name: '캠핑/아웃도어 소품',
    keywords: ['캠핑', '아웃도어', '랜턴', '의자', '테이블', '버너'],
    beginnerFit: 'medium', koreaDemand: 4, chinaSupply: 4, marginBand: [50, 90],
    regulation: '버너류는 KC 대상 (전자 아닌 소품은 무규제)',
    why: '시즌성(봄/가을) — 타이밍 맞추면 회전 좋음.',
  },
  {
    id: 'electronics', name: '전자 액세서리',
    keywords: ['충전', '케이블', '이어폰', '보조배터리', 'LED', '전자', '배터리'],
    beginnerFit: 'hard', koreaDemand: 5, chinaSupply: 5, marginBand: [40, 85],
    regulation: '전기안전확인 (배터리 내장 시 KC 필수) + 관세청 전파 인증',
    why: '수요는 크지만 인증 비용·리콜 리스크 — 초보 비추.',
  },
  {
    id: 'food', name: '식품/건강식품',
    keywords: ['식품', '간식', '차', '커피', '건강식품'],
    beginnerFit: 'avoid', koreaDemand: 5, chinaSupply: 3, marginBand: [30, 60],
    regulation: '식품위생법 수입신고 + 한글표시 + 검역 — 절차 복잡',
    why: '초보가 감당하기 어려운 행정 부담. 명시적 회피 권장.',
  },
  {
    id: 'brand-lookalike', name: '브랜드 유사품',
    keywords: ['명품', '스타일', 'lookalike', '디자이너'],
    beginnerFit: 'avoid', koreaDemand: 4, chinaSupply: 4, marginBand: [80, 200],
    regulation: '상표권/디자인권 침해 — 계정 정지 리스크',
    why: '고마진의 유혹이지만 플랫폼 계정이 날아감. 절대 회피.',
  },
];

export function listCategories(): CategoryMeta[] {
  return CATEGORY_CATALOG;
}

/** Beginner-safe pool: fit easy/medium only (hard/avoid excluded). */
export function beginnerCategories(): CategoryMeta[] {
  return CATEGORY_CATALOG.filter((c) => c.beginnerFit === 'easy' || c.beginnerFit === 'medium');
}

export function classifyTitle(title: string): CategoryMeta | null {
  const t = (title || '').toLowerCase();
  for (const c of CATEGORY_CATALOG) {
    if (c.keywords.some((k) => t.includes(k.toLowerCase()))) return c;
  }
  return null;
}
