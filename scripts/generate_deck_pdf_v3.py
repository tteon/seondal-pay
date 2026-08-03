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
c.drawString(20*mm, H-106*mm, 'Solana M2M 미세결제 × 온톨로지 지식그래프 × 100-카테고리 벤치마크 데이터셋')
c.setFillColor(BLUE); c.setFont('KR-B', 13); c.drawString(20*mm, H-120*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.setFillColor(INK3); c.setFont('KR', 11)
c.drawString(20*mm, 28*mm, 'github.com/tteon/seondal-pay  ·  seondal-pay-1064390008895.us-central1.run.app')
_page[0] += 1
c.setFillColor(INK3); c.setFont('KR', 9); c.drawRightString(W-15*mm, 10*mm, f'SEONDAL // Intelligence · {_page[0]}')
c.showPage()

# ══ S2. 문제 — 히어로 지표 ══
base('01 · 문제', '격차는 실재한다 — 15개 카탈로그 & 100개 카테고리 실측')
hero('72.5%', '우리 컴패레이터가 실측한 최고 ROI (수유등: 랜디드 ₩4,793 vs 쿠팡 ₩17,900)', H-66*mm)
bullets([
    ('소싱 정보의 비대칭', '1688 도매가 1.2만 원짜리가 한국 쿠팡에서는 5.4만 원 — 계산 도구 없이는 3~6개월 내 90% 이탈.'),
    ('데이터셋 확장 실증', '15개 고품질 상품 + 10대 마크로 섹터 100개 카테고리 실측 데이터로 검증 가능.'),
], y=H-92*mm)
c.showPage()

# ══ S3. 문제 — 구조 ══
base('01 · 문제', '혼자 계산할 수 없는 연쇄 과정')
bullets([
    ('연쇄 과정', '시장 조사 → 관세·물류비 → KC 안전인증 → 쿠팡 수수료(10.8%) 공제 후 순마진 계산.'),
    ('도구의 부재', '기존 PG/카드/구독 결제는 사람 전제 — AI 에이전트가 자율 구매할 결제 수단 없음.\n원화 수탁 시 전자금융거래법 PG 등록 리스크 발생.'),
    ('본질', '에이전트가 스스로 결제하고 검증된 소싱 정보를 주고받을 M2M 결제 레일 부재.'),
])
metric_row([('도매-소매 격차', '₩32K → ₩56K', BRAND), ('100 카테고리', '10대 섹터', BLUE), ('이탈 시점', '3~6개월', RED)], 34*mm)
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
        ['100-카테고리 벤치마크', '10대 마크로 섹터 전수 구축', 'SEONDAL DB'],
    ],
    [24*mm, 120*mm, 200*mm], H - 56*mm, row_h=12*mm
)
bullets([
    ('시장의 기회', '초보 셀러 진입자는 폭증하나, 수입원가·규제·마진을 즉시 산출해줄 에이전틱 OS는 부재.'),
], y=H-122*mm)
c.showPage()

# ══ S5. 가설 ══
base('02 · 가설', '세 가설, 세 가지 측정')
table(
    ['가설', '내용', '측정'],
    [
        ['지속성 부재', '수동 계산 피로도가 셀러 포기의 핵심 원인', '100-카테고리 자동 산출'],
        ['리스크 판단 오류', 'KC 안전인증 및 RCEP 관세 누락으로 손실', '온톨로지 가드레일 정밀도'],
        ['M2M 자율 정산', '에이전트 간 결제 레일이 없어 정보 유통 불가', 'Solana HTTP 402 결제 성공률'],
    ],
    [24*mm, 108*mm, 235*mm], H - 56*mm, row_h=12*mm
)
bullets([
    ('검증 원칙', '전부 측정 가능한 형태로 — 사전 등록 실험 2종, 라이브 Solana Devnet 온체인 결제 실증.'),
], y=H-104*mm)
c.showPage()

# ══ S6. 솔루션 요약 ══
base('03 · 솔루션', '에이전트가 판단하고, 온체인이 정산한다')
bullets([
    ('핵심 정의', 'MCP 에이전트 생태계 + pay.sh(MPP) 미세결제로, 1인 셀러 대신 분석·규제 1차 검증·진입 판정을 자율 수행.'),
    ('15+ 카탈로그 & 100-카테고리 엔진',
     '1688 공장가 × RCEP 관세 × 국제 배송비 = 수입원가(Landed Cost)\n쿠팡 벤치마크가 - 10.8% 수수료 = 순마진 및 ROI 실시간 산출.'),
    ('M2M 결제 정산', 'HTTP 402 Challenge → 0.005~0.05 SOL 결제 → Memo externalId 바인딩 → Payment-Receipt 발급.'),
])
c.showPage()

# ══ S7. 작동 플로우 ══
base('04 · 작동 플로우', '402 챌린지부터 리포트까지 8단계')
steps = [
    ('1', '402 챌린지', 'WWW-Authenticate: Payment (JCS, externalId, TTL 300초)'),
    ('2', '정책 검증', '에이전트 예산 한도(≤0.06 SOL) 자율 검증'),
    ('3', '서명·전송', 'SOL transfer + Memo(externalId) → Solana Devnet'),
    ('4', '온체인 검증', '금액·수신자·메모 바인딩 + 리플레이 차단'),
    ('5', '영수증 발급', 'Payment-Receipt (tx 시그니처 = 온체인 정산 증명)'),
    ('6', '크롤링·타이핑', 'JSON-LD 제품 노드 저장 (Cloud SQL + GCS)'),
    ('7', '규제·마진 산출', 'KC 안전인증 가드레일 + RCEP 관세 + 쿠팡 수수료(10.8%) 공제'),
    ('8', '라우팅·알림', '포트폴리오 추천 → Discord 고ROI 푸시 → OpenClaw 핸드오프'),
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
base('05 · 가설 증빙 1', '토큰 −81%, 환각 0% — 온톨로지 파이프라인')
metric_row([
    ('토큰 절감', '−81.4%', GREEN),
    ('팩트 정확도', '98% vs 91%', BLUE),
    ('환각률', '0% vs 9%', GREEN),
    ('추정 비용', '−40.1%', BRAND),
], H-68*mm)
bullets([
    ('실험 설계', '200샘플 사전 등록 실험 · Kimi K3 모델 · 조건별 결제 키 분리 · 결정적 룰 채점.'),
    ('A2A 파이프라인', '자유 텍스트 전달 시 50%(맥락 소실) → 타입드 JSON-LD 전달 시 90% 회복.'),
], y=H-104*mm)
c.showPage()

# ══ S9. 증빙 2 — SaaS UI & 확장 데모 ══
base('05 · 가설 증빙 2', 'Luminous SaaS Console & 3대 확장 시나리오')
bullets([
    ('Modern SaaS Console', 'Glassmorphic UI, 5개 탭(개요, 15+ 카탈로그, 100-카테고리 벤치마크, 라이브 에이전트, 포트폴리오).'),
    ('Scene 1: 자율 결제', '고마진 아이템 발굴 → HTTP 402 Solana Settlement → 온체인 Receipt 발급.'),
    ('Scene 2: 규제 가드레일', 'RCEP 관세율 자동 계산 + KC 안전인증 필요 여부 (펫 피더 vs 식기) 자동 판정.'),
    ('Scene 3: Dynamic Self-Healing', '1688 공장가 변동 시 마진 재산출 및 GitOps ArgoCD 무중단 복구.'),
])
c.showPage()

# ══ S10. 기술 스택 ══
base('06 · 기술 스택', '온체인 결제와 지식 그래프의 결합')
bullets([
    ('결제·정산', 'Solana(web3.js) + pay.sh/MPP(draft-solana-charge-00) 구현 — JCS 정규화, Zero-Custody.'),
    ('지식 그래프', 'schema.org/Product JSON-LD + 100-카테고리 벤치마크 엔진 (Baidu 트렌드, MOQ, KC 가드레일).'),
    ('에이전트', 'MCP 서버(JSON-RPC) — 유료 도구 MPP 게이팅, Kimi 3.0 & MARA 멀티모델 오케스트레이터.'),
    ('인프라 & 관찰성', 'GKE Autopilot + ArgoCD GitOps + Prometheus/Grafana/Loki/Tempo 3축 모니터링.'),
])
c.showPage()

# ══ S11. 아키텍처 ══
base('07 · 아키텍처', 'GitOps 기반 생산급 배포 아키텍처')
bullets([
    ('배포 구조', 'GitHub → ArgoCD(app-of-apps) → GKE Autopilot: 앱 ×2(LB) + 관찰성 5스택 자동동기화.'),
    ('데이터 처리', 'Agent A → LB → HTTP 402 Challenge → Solana Devnet → Cloud SQL (JSONB) 저장.'),
    ('자가 치유', 'ArgoCD가 매니페스트 감시 — 설정 이탈 시 수초 내 수동 intervention 없이 자동 복구.'),
])
c.showPage()

# ══ S12. 비즈니스 모델 ══
base('08 · 비즈니스 모델', '데이터 깊이에 따른 Tier 미세결제')
table(
    ['Tier', '가격', '제공'],
    [
        ['T1', '0.005 SOL', '기본 메타데이터'],
        ['T2', '0.015 SOL', '물류·RCEP 관세·KC 규제 스펙'],
        ['T3', '0.050 SOL', '쿠팡 실측·순마진(10.8% 공제)·ROI·포트폴리오 라우팅'],
    ],
    [24*mm, 60*mm, 105*mm], H - 56*mm, row_h=11*mm
)
bullets([
    ('단위 경제', 'Solana 수수료 ~0.000005 SOL/tx — 마진율 99%+; 데이터 판매 시 즉시 실시간 정산.'),
], y=H-102*mm)
c.showPage()

# ══ S13. 성장 엔진 ══
base('08 · 성장 엔진', '데이터와 에이전트 양면 네트워크')
bullets([
    ('① 데이터 플라이휠', '더 많은 M2M 결제·조회 → 100-카테고리 마진 정밀도 상승 → 신규 셀러 유입 증대.'),
    ('② 온톨로지 데이터 해자', 'JSON-LD 제품 그래프 축적으로 경쟁자가 복제할 수 없는 소싱 지식 자산 구축.'),
    ('③ 에이전트 마켓플레이스', '외부 데이터 공급 에이전트 참여 시 15% 수수료 획득 구조로 확장.'),
])
c.showPage()

# ══ S14. 로드맵 ══
base('09 · 로드맵', '1인 셀러 실전 배포 및 생태계 확장')
bullets([
    ('단기 마일스톤', 'Discord 셀러 커뮤니티 50명 대상 자본맞춤 알림 제공 및 파트너 API 연동.'),
    ('중기 마일스톤', 'USDC(SPL) 안합 정산 지원, x402 v2 Facilitator 분리, UNI-PASS 관세청 RAG 자동화.'),
    ('장기 비전', '글로벌 1688-쿠팡/아마존 크로스보더 M2M 에이전트 결제 수수료 인프라로 도약.'),
])
c.showPage()

# ══ S15. 데모 & 라이브 링크 ══
base('10 · 데모 & 라이브 링크', '확장 3분 데모 및 실시간 시스템')
table(
    ['항목', '링크/접속 정보'],
    [
        ['SaaS Console', 'seondal-pay-1064390008895.us-central1.run.app (또는 http://localhost:3000)'],
        ['GitHub Repo', 'github.com/tteon/seondal-pay'],
        ['Grafana 관찰성', '34.171.84.231 (admin / seondal-admin)'],
        ['ArgoCD GitOps', '136.116.158.227 (admin)'],
        ['Solana Devnet 증명', 'solscan.io/tx/5gHTNnaDWQTvhMZKEuR7ttjhr5jmhbyCHcsiR8dRFxBkh6un1HYVg1Vub38We8cikaKFtkvHj5dmHgtPhrfQaWZW'],
    ],
    [24*mm, 70*mm], H - 56*mm, row_h=11*mm
)
bullets([
    ('3분 확장 데모', 'Act 1 자율 결제 → Act 2 RCEP/KC 가드레일 → Act 3 Dynamic Self-Healing (DEMO_SCENARIO.md 참조)'),
], y=H-116*mm)
c.setFillColor(BRAND); c.setFont('KR-B', 15); c.drawString(22*mm, 20*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.save()
print('PDF v3 updated: docs/SEONDAL_Pay_소개서.pdf')
