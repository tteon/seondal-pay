"""SEONDAL Pay submission deck v3 — takeaway titles, 1 point/slide, <40 words.

Checklist: takeaway title / one key point / fewer than 40 words / no superlatives / 15s grok.
Market figures are marked 추정치. Hero metrics use our own measured data.
"""
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = 338.6 * mm, 190.5 * mm
pdfmetrics.registerFont(TTFont('KR', '/tmp/NanumGothic.ttf'))
pdfmetrics.registerFont(TTFont('KR-B', '/tmp/NanumGothic-Bold.ttf'))

INK = HexColor('#0b0b0b'); INK2 = HexColor('#52514e'); INK3 = HexColor('#898781')
BRAND = HexColor('#4f46e5'); BLUE = HexColor('#2a78d6'); GREEN = HexColor('#0ca30c')
LINE = HexColor('#e1e0d9'); BG = HexColor('#fcfcfb'); RED = HexColor('#d03b3b'); AMBER = HexColor('#c98500')
CARD = HexColor('#f4f4f2')

c = canvas.Canvas('docs/SEONDAL_Pay_소개서.pdf', pagesize=(W, H))
_page = [0]

def base(kicker, takeaway):
    _page[0] += 1
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BRAND); c.setFont('KR-B', 12); c.drawString(20*mm, H-20*mm, kicker)
    c.setFillColor(INK); c.setFont('KR-B', 29); c.drawString(20*mm, H-34*mm, takeaway)
    c.setStrokeColor(LINE); c.setLineWidth(0.7); c.line(20*mm, H-41*mm, W-20*mm, H-41*mm)
    c.setFillColor(INK3); c.setFont('KR', 9)
    c.drawRightString(W-15*mm, 10*mm, f'SEONDAL // Intelligence · {_page[0]}')

def bullets(items, x=22*mm, y=None, size=13, leading=10*mm):
    if y is None: y = H - 54*mm
    for head, body in items:
        if head:
            c.setFillColor(BLUE); c.setFont('KR-B', size); c.drawString(x, y, head)
            y -= leading * 0.62
        c.setFillColor(INK); c.setFont('KR', size)
        for seg in body.split('\n'):
            c.drawString(x + 2*mm, y, seg)
            y -= leading * 0.62
        y -= leading * 0.38
    return y

def hero(value, label, y, x=22*mm, color=BRAND, vsize=44):
    c.setFillColor(color); c.setFont('KR-B', vsize); c.drawString(x, y, value)
    c.setFillColor(INK2); c.setFont('KR', 12.5); c.drawString(x, y-9*mm, label)

def metric_row(metrics, y):
    x = 22*mm; wbox = (W - 44*mm) / len(metrics)
    for label, value, color in metrics:
        c.setFillColor(CARD); c.roundRect(x, y-24*mm, wbox-5*mm, 24*mm, 3*mm, fill=1, stroke=0)
        c.setFillColor(color); c.setFont('KR-B', 18); c.drawString(x+5*mm, y-12*mm, value)
        c.setFillColor(INK2); c.setFont('KR', 9.5); c.drawString(x+5*mm, y-19.5*mm, label)
        x += wbox

def table(headers, rows, colx, y, row_h=10*mm, size=11):
    c.setFont('KR-B', 10.5); c.setFillColor(INK3)
    for h, cx in zip(headers, colx): c.drawString(cx, y, h)
    y -= 4*mm
    c.setStrokeColor(LINE); c.line(colx[0]-2*mm, y+2.5*mm, W-22*mm, y+2.5*mm)
    for row in rows:
        c.setFillColor(INK); c.setFont('KR', size)
        for cell, cx in zip(row, colx):
            if isinstance(cell, tuple):
                txt, color, bold = cell
                c.setFillColor(color); c.setFont('KR-B' if bold else 'KR', size)
                c.drawString(cx, y, txt)
                c.setFillColor(INK); c.setFont('KR', size)
            else:
                c.drawString(cx, y, cell)
        y -= row_h
    return y

# ══ S1. 표지 ══
c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(BRAND); c.roundRect(20*mm, H-52*mm, 34*mm, 10*mm, 3*mm, fill=1, stroke=0)
c.setFillColor(HexColor('#ffffff')); c.setFont('KR-B', 12); c.drawCentredString(37*mm, H-48.7*mm, 'SEONDAL PAY')
c.setFillColor(INK); c.setFont('KR-B', 40); c.drawString(20*mm, H-78*mm, '에이전트가 스스로 결제하는')
c.drawString(20*mm, H-92*mm, '크로스볼셀러 소싱 인텔리전스')
c.setFillColor(INK2); c.setFont('KR', 14)
c.drawString(20*mm, H-106*mm, 'AI 에이전트 생태계(MCP)와 Solana 미세결제로, 1인 셀러의 분석·규제·진입을 자율 수행')
c.setFillColor(BLUE); c.setFont('KR-B', 13); c.drawString(20*mm, H-120*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.setFillColor(INK3); c.setFont('KR', 11)
c.drawString(20*mm, 28*mm, 'github.com/tteon/seondal-pay  ·  seondal-pay-1064390008895.us-central1.run.app')
_page[0] += 1
c.setFillColor(INK3); c.setFont('KR', 9); c.drawRightString(W-15*mm, 10*mm, f'SEONDAL // Intelligence · {_page[0]}')
c.showPage()

# ══ S2. 문제 — 히어로 지표 ══
base('01 · 문제', '격차는 실재한다 — 실측 72.5% 마진')
hero('72.5%', '우리 컴패레이터가 실측한 ROI 사례 (수유등: 랜디드 ₩4,793 vs 쿠팡 최저 ₩17,900)', H-66*mm)
bullets([
    ('그런데', '셀러 대부분은 이 계산 없이 진입합니다 — 재고 부담·통관 거부·과대광고 제재로 3~6개월 내 이탈.'),
    ('히어로 페르소나', '자본 ₩300만의 초기 셀러 — 하루 3시간을 검색에 쓰지만, 랜디드코스트는 엑셀로도 못 구합니다.'),
], y=H-92*mm)
c.showPage()

# ══ S3. 문제 — 구조 ══
base('01 · 문제', '혼자 계산할 수 없는 연쇄 과정')
bullets([
    ('연쇄 과정', '시장 조사 → 규제 검토 → 수수료·물류비 → 상품 등록. 전부 1인 셀러의 수작업입니다.'),
    ('도구의 부재', '유용한 데이터는 있으나, 기계가 즉시 구매·검증할 수단이 없습니다.\nPG·구독·API 키는 사람 전제이고, 원화 예치는 전자금융거래법 PG 등록 의무.'),
    ('본질', '정보 비대칭은 기술 부족이 아니라, 에이전트가 스스로 거래할 결제·검증 레일의 부재입니다.'),
])
metric_row([('도매-소매 격차', '₩32K → ₩56K', BRAND), ('초기 자본', '₩300만', BLUE), ('이탈 시점', '3~6개월', RED)], 34*mm)
c.showPage()

# ══ S4. 시장 ══
base('01 · 시장', '시장은 크고, 진입 도구는 없다')
table(
    ['지표', '규모 (추정치)', '출처'],
    [
        ['쿠팡 연매출', '약 41조원 (2024)', 'Coupang Inc. 공시'],
        ['쿠팡 마켓플레이스(3P) 성장', '연 60%+', '동 공시'],
        ['국내 이커머스 시장', '약 200조원+', '통계청'],
        ['해외직구(역직구 포함) 급증', '중국발 직구 연 5조원대', '관세청·언론'],
        ['1인 사업자/사입 창업', '수백만, 2030 급증', '통계청·중기부'],
    ],
    [24*mm, 120*mm, 200*mm], H - 56*mm, row_h=12*mm
)
bullets([
    ('읽는 법', '쿠팡 3P가 가장 빠르게 커지는 시장 — 진입자는 느는데, 진입 판정 데이터는 없습니다.'),
], y=H-122*mm)
c.showPage()

# ══ S5. 가설 ══
base('02 · 가설', '세 가설, 세 가지 측정')
table(
    ['가설', '내용', '측정'],
    [
        ['지속성 부재', '포기는 의지가 아니라 수동 계산의 피로도 때문', '계산 자동화 여부'],
        ['리스크 판단 오류', '규제·숨은 비용을 예측 못 해 자금 손실', 'LLM 판정 오류율'],
        ['시스템 부재', '강의가 아니라 대신 실행하는 에이전트가 필요', '자율 결제·정산 실현'],
    ],
    [24*mm, 108*mm, 235*mm], H - 56*mm, row_h=12*mm
)
bullets([
    ('검증 원칙', '전부 측정 가능한 형태로 — 사전 등록 실험 2종(200 호출), 실제 devnet 결제, 라이브 시스템.'),
], y=H-104*mm)
c.showPage()

# ══ S6. 솔루션 요약 ══
base('03 · 솔루션', '에이전트가 판단하고, 온체인이 정산한다')
bullets([
    ('한 문장', 'MCP 에이전트 생태계 + pay.sh(MPP) 미세결제로, 1인 셀러 대신 분석·규제 1차 검증·진입 판정을 자율 수행.'),
    ('에이전트의 세 판단',
     '① 유의성 — 쿠팡 Wing 산식으로 순마진 계산, 마켓 파이와 비교해 진입 가이던스\n② 예산 — 데이터 구매 시 ≤0.06 SOL 정책 적합 여부\n③ 규제 — 결정론적 룰 엔진 1차 선별 (모호하면 사람에게)'),
    ('온체인 동작', 'pay.sh(MPP)로 Tier 0.005~0.05 SOL 미세결제 → externalId를 Memo에 기록 → 온체인 검증 → Payment-Receipt.'),
])
c.showPage()

# ══ S7. 작동 플로우 ══
base('04 · 작동 플로우', '402 챌린지부터 리포트까지 8단계')
steps = [
    ('1', '402 챌린지', 'WWW-Authenticate: Payment (JCS, externalId, TTL 300초)'),
    ('2', '정책 검증', '예산 한도 자율 판단 — 무승인'),
    ('3', '서명·전송', 'SOL transfer + Memo(externalId) → devnet'),
    ('4', '온체인 검증', '금액·수신자·메모 바인딩 + 리플레이 차단'),
    ('5', '영수증', 'Payment-Receipt (tx 시그니처 = 정산 증명)'),
    ('6', '크롤링·타이핑', 'JSON-LD 노드 → GCS + Cloud SQL'),
    ('7', '규제·마진', '룰 가드레일 + 쿠팡 실측−수수료−배송 vs 랜디드'),
    ('8', '라우팅·알림', '프로파일 매칭 → Discord(고ROI) → OpenClaw 핸드오프'),
]
y = H - 52*mm
for n, t, d in steps:
    c.setFillColor(BLUE); c.circle(25*mm, y+2*mm, 3.2*mm, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('KR-B', 11); c.drawCentredString(25*mm, y+0.8*mm, n)
    c.setFillColor(INK); c.setFont('KR-B', 13.5); c.drawString(32*mm, y+3*mm, t)
    c.setFillColor(INK2); c.setFont('KR', 11.5); c.drawString(32*mm, y-2.5*mm, d)
    y -= 15.5*mm
c.showPage()

# ══ S8. 증빙 1 — 실험 ══
base('05 · 가설 증빙 1', '토큰 −81%, 환각 0% — 타입드 노드의 힘')
metric_row([
    ('토큰 절감', '−81.4%', GREEN),
    ('팩트 정확도', '98% vs 91%', BLUE),
    ('환각률', '0% vs 9%', GREEN),
    ('추정 비용', '−40.1%', BRAND),
], H-68*mm)
bullets([
    ('설계', '사전 등록 · 200 호출 · 동일 모델(Kimi K3) · 조걳별 결제 키 분리 · 결정적 룰 채점.'),
    ('멀티에이전트', '자유 텍스트 핸드오프 50%(맥락 소실) → 타입드 JSON 90% 회복 — 타입드 경계가 본질.'),
], y=H-104*mm)
c.showPage()

# ══ S9. 증빙 2 — 온체인 + 감사 ══
base('05 · 가설 증빙 2', '실결제가 온체인에 있다')
bullets([
    ('실결제', 'Agent A가 devnet에 0.05 SOL 실제 전송 → 서버 온체인 검증 → Payment-Receipt.\ntx 2VDRaQ9X…BkH — solscan에서 누구나 조회. Memo의 externalId로 바인딩 확인.'),
    ('독립 감사', '원시 200건 재집계 일치 · trace_id 200개 유일 · 응답 전문 캡처로 환각 실례(디스트랙터 오인용) 확인.'),
    ('무중단 실연', '레플리카 2→1 수동 조작 → ArgoCD가 Git 상태로 수십 초 내 자동 복귀.'),
])
c.showPage()

# ══ S10. 기술 스택 ══
base('06 · 기술 스택', '타입드 노드만 오가는 이유')
bullets([
    ('결제·정산', 'Solana(web3.js) + pay.sh/MPP(draft-solana-charge-00) 양방향 구현 — JCS 정규화, atomic 소비, Zero-Custody.'),
    ('지식 그래프', 'schema.org/Product 정합 JSON-LD + ODK/OWL(seondal-product.ofn) — MOQ 사다리·RCEP·공급처 신뢰 등 도메인 확장.'),
    ('에이전트', 'MCP 서버(JSON-RPC) — 도구 8종, 유료 도구는 MPP 결제 게이팅. openai-agents SDK 역할 분해 실험.'),
    ('규제', '결정론적 룰 엔진(KC·전파·전안법·식품위생) — UNI-PASS·식약처 DB RAG는 차기 마일스톤.'),
    ('인프라', 'GKE Autopilot + ArgoCD app-of-apps · Cloud SQL(JSONB)+Auth Proxy · Cloud Run · Secret Manager.'),
    ('관찰성', 'OTel + Prometheus + Grafana + Loki + Tempo — 메트릭·로그(trace_id)·트레이스 3축.'),
])
c.showPage()

# ══ S11. 아키텍처 ══
base('07 · 아키텍처', '무중단은 선언이다 — GitOps')
bullets([
    ('흐름', 'GitHub → ArgoCD(app-of-apps) → GKE Autopilot: 앱 ×2(LB) + 관찰성 5스택. Cloud Run이 평가자 접속면.'),
    ('결제 경로', 'Agent A → LB → 402 → devnet(에이전트 직접 전송) → 서버 검증 → 크롤링 → GCS + Cloud SQL(Proxy) → 알림.'),
    ('무중단 장치', '레플리카 2 · 헬스 프로브 · DB 재시도(5회) · 시크릿은 Secret만 · 장애 주입 복귀 실연.'),
])
c.showPage()

# ══ S12. 비즈니스 모델 ══
base('08 · 비즈니스 모델', '쿼리당 결제, 데이터가 깊이를 판다')
table(
    ['Tier', '가격', '제공'],
    [
        ['T1', '0.005 SOL', '기본 메타데이터'],
        ['T2', '0.015 SOL', '물류·도매 스펙'],
        ['T3', '0.050 SOL', '쿠팡 실측·판매자 경제·ROI·라우팅'],
    ],
    [24*mm, 60*mm, 105*mm], H - 56*mm, row_h=11*mm
)
bullets([
    ('단위경제', '수수료 ~0.000005 SOL/tx — 거래 = 사용 증거 = 매출. 확장: 프리미엄 피드 · 스토어 수수료 15% · 프라이빗 배포.'),
], y=H-102*mm)
c.showPage()

# ══ S13. 성장 엔진 ══
base('08 · 성장 엔진', '성장은 복리로 쌓인다 — 3개의 플라이휠')
bullets([
    ('① 데이터 플라이휠', '더 많은 결제·관측 → 마켓 파이·컴패레이터 정확도 ↑ → 다음 사용자에게 더 가치 → 더 많은 결제.'),
    ('② 온톨로지 자산', '타이핑된 상품 그래프가 축적될수록 매칭 정밀도 ↑ — 후발자가 못 쫓는 데이터 해자.'),
    ('③ 에이전트 양면 시장', '데이터 판매자(도구)가 모이면 구매자가 온다 → MCP 마켓플레이스의 수수료가 거래량에 복리.'),
    ('비용 구조', '거래 원가 ~0 (Solana 수수료) — 볼륨이 커져도 인걸비가 아니라 인프라만 선형.'),
])
c.showPage()

# ══ S14. 로드맵 ══
base('09 · 로드맵', '다음은 실전 검증 — 1인 셀러 코호트')
bullets([
    ('목표', '아이디어의 현실성 검증 — 실제 1인 창업자에게 배포하고 피드백 루프로 제품을 다듬는다.'),
    ('실험 설계', 'Discord 셀러 커뮤니티 코호트 30~50명 → 관심 프로파일 등록 → 주간 고ROI 알림 제공.'),
    ('측정 지표', '활성화율(알림→콘솔 방문) · 전환율(리포트→리스팅 의사) · 재사용률(주간 재방문) · NPS.'),
    ('판정 기준', '코호트 30% 이상이 4주 내 재사용 시 제품-시장 적합 신호로 간주, 아니면 프로파일/알림 재설계.'),
    ('이후', 'Partners 승인(마켓 실측 API) · 규제 RAG(UNI-PASS·식약처) · USDC 정산 · 프라이빗 배포.'),
])
c.showPage()

# ══ S15. 링크 + 실행 ══
base('10 · 라이브 링크', '지금 바로 확인하세요')
table(
    ['항목', '값'],
    [
        ['SaaS Console', 'seondal-pay-1064390008895.us-central1.run.app  (evaluator@seondal.demo / seondal2026!)'],
        ['GitHub', 'github.com/tteon/seondal-pay (README 실행 가이드)'],
        ['Grafana', '34.171.84.231  (admin / seondal-admin)'],
        ['ArgoCD', '136.116.158.227  (admin — docs/ACCESS.md)'],
        ['온체인 증명', 'solscan.io/tx/2VDRaQ9X…BkH?cluster=devnet'],
    ],
    [24*mm, 70*mm], H - 56*mm, row_h=11*mm
)
bullets([
    ('로컬 재현', 'npm run build → test_mpp_flow.ts (MPP 7종) · test_mcp_flow.ts (MCP 7종) · experiments/*.py (실험)'),
], y=H-116*mm)
c.setFillColor(BRAND); c.setFont('KR-B', 15); c.drawString(22*mm, 20*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.save()
print('PDF v3 generated: docs/SEONDAL_Pay_소개서.pdf')
