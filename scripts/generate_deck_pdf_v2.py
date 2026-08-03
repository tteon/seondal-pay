"""SEONDAL Pay submission deck v2 — structure per user spec.

Sections: 표지 / 문제 정의 / 가설 / 솔루션 요약 / 가설 증빙 / 기술 스택 /
아키텍처 / 작동 플로우 / 비즈니스 모델 / 데모 영상 시놉시스 / 라이브 링크+실행가이드.
Language: professional Korean; proper nouns only (MPP, Solana, MCP, GKE…).
"""
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = 338.6 * mm, 190.5 * mm  # 16:9
pdfmetrics.registerFont(TTFont('KR', '/tmp/NanumGothic.ttf'))
pdfmetrics.registerFont(TTFont('KR-B', '/tmp/NanumGothic-Bold.ttf'))

INK = HexColor('#0b0b0b'); INK2 = HexColor('#52514e'); INK3 = HexColor('#898781')
BRAND = HexColor('#4f46e5'); BLUE = HexColor('#2a78d6'); GREEN = HexColor('#0ca30c')
LINE = HexColor('#e1e0d9'); BG = HexColor('#fcfcfb'); RED = HexColor('#d03b3b'); AMBER = HexColor('#c98500')
CARD = HexColor('#f4f4f2')

c = canvas.Canvas('docs/SEONDAL_Pay_소개서.pdf', pagesize=(W, H))
_page = [0]

def page_base(kicker, title, subtitle=None):
    _page[0] += 1
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BRAND); c.setFont('KR-B', 12); c.drawString(20*mm, H-20*mm, kicker)
    c.setFillColor(INK); c.setFont('KR-B', 27); c.drawString(20*mm, H-33*mm, title)
    if subtitle:
        c.setFillColor(INK2); c.setFont('KR', 12.5); c.drawString(20*mm, H-40.5*mm, subtitle)
    c.setStrokeColor(LINE); c.setLineWidth(0.7); c.line(20*mm, H-45*mm, W-20*mm, H-45*mm)
    c.setFillColor(INK3); c.setFont('KR', 9)
    c.drawRightString(W-15*mm, 10*mm, f'SEONDAL // Intelligence · {_page[0]}')

def bullets(items, x=22*mm, y=None, size=13.5, leading=10.2*mm, title_size=None):
    if y is None: y = H - 56*mm
    title_size = title_size or size
    for head, body in items:
        if head:
            c.setFillColor(BLUE); c.setFont('KR-B', title_size); c.drawString(x, y, head)
            y -= leading * 0.62
        c.setFillColor(INK); c.setFont('KR', size)
        for seg in body.split('\n'):
            c.drawString(x + 2*mm, y, seg)
            y -= leading * 0.62
        y -= leading * 0.38
    return y

def metric_row(metrics, y):
    x = 22*mm; wbox = (W - 44*mm) / len(metrics)
    for label, value, color in metrics:
        c.setFillColor(CARD); c.roundRect(x, y-24*mm, wbox-5*mm, 24*mm, 3*mm, fill=1, stroke=0)
        c.setFillColor(color); c.setFont('KR-B', 19); c.drawString(x+5*mm, y-12*mm, value)
        c.setFillColor(INK2); c.setFont('KR', 10); c.drawString(x+5*mm, y-19.5*mm, label)
        x += wbox

def table(headers, rows, colx, y, row_h=9.5*mm, size=11.5, head_size=11):
    c.setFont('KR-B', head_size); c.setFillColor(INK3)
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

# ═══════════════════════ S1. 표지 ═══════════════════════
c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(BRAND); c.roundRect(20*mm, H-50*mm, 34*mm, 10*mm, 3*mm, fill=1, stroke=0)
c.setFillColor(HexColor('#ffffff')); c.setFont('KR-B', 12); c.drawCentredString(37*mm, H-46.7*mm, 'SEONDAL PAY')
c.setFillColor(INK); c.setFont('KR-B', 40); c.drawString(20*mm, H-74*mm, '에이전트가 스스로 결제하는')
c.drawString(20*mm, H-88*mm, '크로스볼셀러 소싱 인텔리전스')
c.setFillColor(INK2); c.setFont('KR', 15)
c.drawString(20*mm, H-102*mm, 'AI 에이전트 생태계(MCP)와 Solana 미세결제로, 1인 셀러의 시장 분석·규제 검증·진입 판정을 자율 수행')
c.setFillColor(BLUE); c.setFont('KR-B', 14); c.drawString(20*mm, H-118*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.setFillColor(INK2); c.setFont('KR', 11.5)
c.drawString(20*mm, 36*mm, 'SEONDAL // Intelligence')
c.drawString(20*mm, 28*mm, 'github.com/tteon/seondal-pay  ·  Live: seondal-pay-1064390008895.us-central1.run.app')
_page[0] += 1
c.setFillColor(INK3); c.setFont('KR', 9); c.drawRightString(W-15*mm, 10*mm, f'SEONDAL // Intelligence · {_page[0]}')
c.showPage()

# ═══════════════════════ S2. 문제 정의 ═══════════════════════
page_base('01 · 문제 정의', '혼자서는 불가능한 연쇄 과정')
bullets([
    ('국내 1인 커머스 사입 창업의 구조적 문제',
     '초기 시장 조사 → 규제 검토 → 수수료·물류비 계산 → 상품 등록에 이르는 복잡한 연쇄 과정을 창업자가 홀로 수행해야 합니다.\n단기 강의를 수강핼어도 지속적인 데이터 추적과 리스크 관리가 불가능하여, 사입 실패(재고 부담, 통관 거부, 과대광고 제재)를 겪고\n3~6개월 내에 대거 이탈합니다.'),
    ('왜 지금 문제인가',
     '유용한 시장 데이터는 존재하지만, 그것을 즉시 구매하고 검증할 기계적 수단이 없습니다.\n기존 결제(PG·구독·API 키)는 전부 사람 전제이고, 플랫폼이 원화를 예치하면 전자금융거래법상 PG 등록 의무가 발생합니다.\n정보 비대칭은 기술 부족이 아니라, 에이전트가 스스로 거래할 결제·검증 레일의 부재가 원인입니다.'),
])
metric_row([
    ('도매-소매 격차 사례', '₩32K → ₩56K', BRAND),
    ('초기 셀러 자본', '₩300만', BLUE),
    ('사입 실패 요인 3종', '재고·통관·제재', RED),
], 34*mm)
c.showPage()

# ═══════════════════════ S3. 가설 ═══════════════════════
page_base('02 · 가설', '검증할 세 가지 가설')
bullets([
    ('가설 1 — 지속성 부재',
     '1인 셀러의 높은 중도 포기율은 의지 부족이 아니라, 수동 데이터 수집과 복잡한 수수료 계산 과정의 피로도 때문일 것이다.'),
    ('가설 2 — 리스크 판단 오류',
     '검색량이나 경쟁 강도만 보고 사입 결정을 내리기 때문에, 해외 통관 규제(KC 인증, 금지 성분 등)와\n숨겨진 물류 비용을 예측하지 못해 치명적 자금 손실을 입을 것이다.'),
    ('가설 3 — 시스템의 부재',
     '셀러에게 필요한 것은 일회성 강의나 엑셀 서식이 아니라, 규제 검증부터 데이터 수집·결제·등록까지\n대신 실행해 주는 AI 에이전트 기반의 자동화 파이프라인일 것이다.'),
])
c.setFillColor(CARD); c.roundRect(20*mm, 24*mm, W-40*mm, 34*mm, 4*mm, fill=1, stroke=0)
c.setFillColor(BRAND); c.setFont('KR-B', 13); c.drawString(26*mm, 48*mm, '검증 방법')
c.setFillColor(INK); c.setFont('KR', 12)
c.drawString(26*mm, 40*mm, '세 가설은 전부 "측정 가능한 형태"로 검증합니다 — 사전 등록 실험(200건 LLM 호출, 조걳별 결제 키 분리),')
c.drawString(26*mm, 32*mm, '실제 온체인 결제(Solana devnet, 누구나 조회 가능), 라이브 시스템(GKE + Cloud Run)의 세 축으로 증빙합니다.')
c.showPage()

# ═══════════════════════ S4. 솔루션 요약 ═══════════════════════
page_base('03 · 솔루션 요약', 'AI 에이전트 생태계 + 온체인 미세결제')
bullets([
    ('seondal-pay란',
     'MCP(Model Context Protocol) 기반 AI 에이전트 생태계와 Solana pay.sh(MPP, draft-solana-charge-00) 미세결제를 결합해,\n1인 셀러 대신 시장 데이터 분석부터 규제 1차 검증, 진입 판정까지 자율 수행하는 AI 네이티브 커머스 오케스트레이션입니다.'),
    ('에이전트가 자율 판단하는 것',
     '① 소싱 후보의 유의성 — 쿠팡 Wing 산식(실측가-수수료 10.8%-배송비)과 랜디드코스트로 순마진을 계산하고,\n    시장 TOP5 판매자의 비용 구조(마켓 파이)와 비교해 진입 여부와 가이던스를 제공\n② 데이터 구매 시 예산 정책(≤0.06 SOL) 적합 여부\n③ 규제 리스크 — 결정론적 룰 엔진으로 KC 인증·전파·전안법·식품위생 1차 선별 (모호하면 사람에게 에스컬레이션)'),
    ('온체인 트랜잭션',
     '에이전트가 전문 데이터를 구매할 때 pay.sh(MPP)로 Tier(0.005~0.05 SOL) 미세결제를 자율 서명·실행하고,\nexternalId를 온체인 Memo에 기록해 챌린지<->결제를 바인딩합니다. 서버는 금액·수신자·메모를 온체인 검증 후\nPayment-Receipt를 발행하며, 모든 거래는 devnet에서 투명하게 조회됩니다.'),
])
c.showPage()

# ═══════════════════════ S5. 가설 증빙 (2p) ═══════════════════════
page_base('04 · 가설 증빙 — 1/2', '주장이 아니라 측정으로')
table(
    ['가설', '검증 방법', '결과'],
    [
        ['가설 1 (지속성 부재)', '컴패레이터가 수수료·랜디드코스트·마켓 파이를 상시 자동 계산', ('자동화 완료 — 수동 계산 제거', GREEN, True)],
        ['가설 2 (리스크 판단 오류)', 'KC 규제 골든 룰로 LLM 판정 오류율 측정', ('LLM 단독 50~90% 오류 → 룰+타입드 핸드오프 90% 회복', BLUE, True)],
        ['가설 3 (시스템 부재)', '에이전트가 예산 내 자율 서명·결제·정산 완료 여부', ('devnet 실결제 완료 — 무승인·1초 확정', GREEN, True)],
    ],
    [24*mm, 95*mm, 195*mm], H - 56*mm, row_h=12*mm
)
bullets([
    ('증빙 1 — 온톨로지 실험 (200 호출, 사전 등록)',
     '원시 텍스트 vs 타입드 노드: 토큰 -81.4%, 정확도 98% vs 91%, 환각 0% vs 9%, 추정 비용 -40.1%.\n→ "타입드 노드만 오가는 A2A"가 비용과 정확도 모두 우월함을 입증 (실험 1, 기준 3종 전부 충족)'),
    ('증빙 2 — 실제 온체인 결제',
     'Agent A가 402 챌린지 수신 → 예산 정책 자율 검토 → devnet에 0.05 SOL 실제 전송 → 서버가 온체인 검증 → Payment-Receipt.\ntx: 2VDRaQ9X…BkH — solscan(devnet)에서 누구나 조회 가능. Memo의 externalId로 챌린지<->결제 바인딩 확인됨.'),
], y=H-104*mm)
c.showPage()

page_base('04 · 가설 증빙 — 2/2', '독립 감사 트레일')
bullets([
    ('감사 1 — 집계 정합성',
     '실험 원시 데이터 200건을 독립 재집계 → 보고 수치(토큰·정확도·환각·비용)와 정확히 일치'),
    ('감사 2 — 실제 호출 증거',
     'trace_id 200개 전부 유일, 실행 시간창 연속, 지연>0 198건 — 호출이 실제 발생함을 입증'),
    ('감사 3 — 응답 캡처 재채점',
     '실제 모델 응답 전문을 저장·육안 대조 — 환각 케이스가 원문 속 허수 값(디스트랙터)을 오인용한 실례 확인'),
    ('증빙 3 — 멀티에이전트 실험 (openai-agents SDK)',
     '통합 에이전트 90% vs 자유 텍스트 핸드오프 50%(맥락 소실) vs 타입드 JSON 핸드오프 90% 회복.\n→ 역할 분해 자체가 아니라 "타입드 경계"가 멀티에이전트를 성립시킴을 실증'),
    ('증빙 4 — 무중단 운영',
     '레플리카 수동 조작(2→1) → ArgoCD가 Git 상태로 자동 복귀(수십 초). Grafana/Loki/Tempo로 결제 전 과정 추적 가능.'),
])
c.showPage()

# ═══════════════════════ S6. 기술 스택 (2p) ═══════════════════════
page_base('05 · 기술 스택 — 1/2', '결제와 지식 그래프')
bullets([
    ('M2M 결제·정산 (Agent-to-Agent Economy)',
     'Solana(web3.js) + pay.sh/MPP(draft-solana-charge-00) — HTTP 402 기반 Machine Payments Protocol을 양방향 직접 구현.\nJCS(RFC 8785) 규격 정규화, Atomic check-and-consume으로 이중지불·TTL 리플레이 차단.\nOn-chain binding — Memo instruction으로 챌린지<->결제 1:1 바인딩(solscan 검증 가능).\nZero-Custody — 자금 비수탁 구조로 전자금융거래법 PG 이슈 우회.'),
    ('자율 결제 에이전트',
     '예산 정책(≤0.06 SOL) 내 서명·devnet 전송을 무승인 자율 실행. 만료 시 bounded retry, mock sandbox 폴찌 포함.'),
    ('지식 그래프 (정보 비대칭 해소의 언어)',
     'schema.org/Product 정합 JSON-LD — 원시 텍스트 금지, 타입드 노드만 A2A 전달 (환각 제어).\nODK 기반 OWL 온톨로지(seondal-product.ofn) — 버전 IRI로 관리되는 코어 스키마 + 중국 소싱 도메인 확장\n(MOQ 가격 사다리, RCEP 관세 특혜, 공급처 신뢰 지표, 암묵 품질 지표, 무재고 판매 조건).\nAWS Ontology Mining 기법 — 분류 체계 확장(hypernym/synonym), Tier별 데이터 중요도 분리.'),
])
c.showPage()

page_base('05 · 기술 스택 — 2/2', '에이전트 오케스트레이션과 인프라')
bullets([
    ('MCP 서버 (JSON-RPC 2.0)',
     '플랫폼을 Claude/MCP 클라이언트의 도구로 노출 — 묣료 도구 6종 + 유료 도구는 동일 MPP 검증으로 게이팅.\n에이전트가 도구를 구매하는 Agent micro-economy의 실체.'),
    ('역할 분해 멀티에이전트',
     'Classifier·Cost·Compliance·Recommender 전문 에이전트 분할. OpenAI Agents SDK 실험으로 타입드 JSON 핸드오프 필요성 실증.'),
    ('규제 가드레일 (결정론적 1차 필터)',
     'KC 인증·전파법·전안법·식품위생을 룰 엔진으로 구현 — LLM 환각 배제, 기관 라우팅·예상 비용/기간 제시.\n관세청 UNI-PASS·식약처 위해식품 DB 연동 RAG는 설계 완료, 차기 마일스톤.'),
    ('엔터프라이즈 인프라 (GCP / GitOps)',
     'GKE Autopilot + ArgoCD(app-of-apps) — 선언적 배포·자기치유 실연.\nCloud SQL(PostgreSQL, JSONB+GIN) + Auth Proxy 사이드카 — 무중단 안전 커넥션.\nCloud Run(SaaS Console) · Artifact Registry · GCS(불변 아카이브) · Secret Manager(시크릿 제로 커밋).'),
    ('관찰성 3축',
     'OpenTelemetry + Prometheus + Grafana + Loki + Tempo — 메트릭·로그(trace_id 상관)·트레이스 통합. Alertmanager → Discord.'),
])
c.showPage()

# ═══════════════════════ S7. 아키텍처 ═══════════════════════
page_base('06 · 아키텍처', 'Google Cloud 위 무중단 GitOps')
bullets([
    ('GitOps 운영',
     'GitHub가 유일한 진실 원천 — ArgoCD app-of-apps가 앱(seondal-pay ×2)과 관찰성 5스택을 선언적으로 배포·자기치유.\n수동 조작도 Git 상태로 자동 복귀 (실연 검증).'),
    ('결제·데이터 경로',
     'Agent A → Cloud Run/GKE LoadBalancer → 402 챌린지 → Solana devnet(에이전트 직접 전송·확정)\n→ 서버 온체인 검증 → 크롤링 → GCS(원본 아카이브) + Cloud SQL(JSON-LD, Auth Proxy 경유)\n→ 컴패레이터/마켓 파이 → Discord 알림(고ROI) · 모든 단계 OTel 추적'),
    ('무중단 장치',
     '레플리카 2 + 롤링 업데이트 · 헬스 프로브(/api/health) · DB 프록시 부팅 경쟁은 앱 레벨 재시도(5회)\n· 시크릿은 K8s Secret/Secret Manager로만 주입 · GKE Autopilot 노드 무관리'),
    ('관찰성',
     'Prometheus(/metrics) · Grafana 대시보드(결제·크롤링·DB) · Loki 로그(trace_id) · Tempo 트레이스\n· 커스텀 알림 룰 7종(다운/5xx/검증실패/리플레이/만료율/폴찌/Discord) → Discord'),
])
c.showPage()

# ═══════════════════════ S8. 작동 플로우 (2p) ═══════════════════════
page_base('07 · 작동 플로우 — 1/2', '402 챌린지부터 리포트까지')
steps = [
    ('1', '402 챌린지', 'WWW-Authenticate: Payment (JCS+base64url, externalId, TTL 300초)'),
    ('2', '정책 검증', '에이전트가 예산 한도(≤0.06 SOL) 자율 판단 — 무승인'),
    ('3', '서명·전송', 'SOL transfer + Memo(externalId) → Solana devnet'),
    ('4', '온체인 검증', '금액·수신자·메모 바인딩 + 리플레이 차단(atomic)'),
    ('5', '영수증', 'Payment-Receipt 발행 (tx 시그니처 = 정산 증명)'),
    ('6', '크롤링·타이핑', 'JSON-LD 노드 생성 → GCS + Cloud SQL(JSONB)'),
    ('7', '규제·마진', '결정론적 규제 가드레일 + 쿠팡 실측-수수료-배송 vs 랜디드코스트'),
    ('8', '라우팅·알림', '관심 프로파일 매칭 → Discord 알림(고ROI) → OpenClaw 핸드오프'),
]
y = H - 54*mm
for n, t, d in steps:
    c.setFillColor(BLUE); c.circle(25*mm, y+2*mm, 3.2*mm, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('KR-B', 11); c.drawCentredString(25*mm, y+0.8*mm, n)
    c.setFillColor(INK); c.setFont('KR-B', 13.5); c.drawString(32*mm, y+3*mm, t)
    c.setFillColor(INK2); c.setFont('KR', 11.5); c.drawString(32*mm, y-2.5*mm, d)
    y -= 15.5*mm
c.showPage()

page_base('07 · 작동 플로우 — 2/2', '사용자 화면에서 보이는 것')
bullets([
    ('SaaS Console (평가자 체험 경로)',
     '로그인 → 타일(지갑 잔액 실시간·검증 매출·활성 챌린지·처리 결제) → 카탈로그 ROI 배지\n→ 마켓 파이 도넛(그룹별 TOP5 판매 점유율) → 마진 TOP5 도넛 → 라이브 소싱 챗'),
    ('라이브 소싱 챗 (실제 파이프라인)',
     '"유아 롬퍼" 입력 → 7단계가 채팅으로 실시간 실행:\n카탈로그 스캔 → MPP 챌린지 → 온톨로지 타이핑 → 규제 가드레일 → 쿠팡 판매자 추정 경제 → 프로파일 라우팅 → 리포트 카드'),
    ('MCP로 외부 에이전트가 쓰는 경로',
     'Claude/MCP 클라이언트 → get_payment_challenge → Solana 결제(Memo) → get_sourcing_analysis\n→ 동일 검증 경로로 도구 결과 수신 (Agent micro-economy)'),
])
c.showPage()

# ═══════════════════════ S9. 비즈니스 모델 ═══════════════════════
page_base('08 · 비즈니스 모델', '데이터가 팔릴 때마다 0.005~0.05 SOL')
table(
    ['Tier', '가격', '제공 데이터'],
    [
        ['Tier 1', '0.005 SOL', '기본 메타데이터 (카탈로그·검색)'],
        ['Tier 2', '0.015 SOL', '물류·도매 스펙 (MOQ·무게·랜디드 요소)'],
        ['Tier 3', '0.050 SOL', '쿠팡 실측·판매자 추정 경제·ROI·프로파일 라우팅'],
    ],
    [24*mm, 60*mm, 105*mm], H - 56*mm, row_h=11*mm
)
bullets([
    ('단위경제', 'Solana 수수료 ~0.000005 SOL/tx — 결제 자체가 사용 증거이자 매출 지표. 마진율 사실상 99%+.'),
    ('확장 경로', '컴패레이터 프리미엄 피드(프로파일 알림) · 파트너 데이터 스토어(수수료 15%) · 엔터프라이즈 프라이빗 배포.'),
    ('왜 온체인인가', '구독이 아니라 쿼리당 결제(Pay-per-query) — 에이전트 경제에서 정산·증빙이 온체인에 투명하게 남는 유일한 구조.'),
], y=H-100*mm)
c.showPage()

# ═══════════════════════ S10. 데모 영상 시놉시스 ═══════════════════════
page_base('09 · 데모 영상 (3분) 시놉시스', '에이전트가 돈을 내는 순간을 보여줍니다')
table(
    ['시간', '장면', '내용'],
    [
        ['0:00–0:12', '콜드오픈', '도매 ₩32K vs 소매 ₩56K — "이 격차를 에이전트가 스스로 결제해 검증"'],
        ['0:12–0:45', '온체인 결제 (메인)', '402 수신 → 예산 체크 → 자율 서명 → devnet 확정 → Receipt. solscan Memo 확대'],
        ['0:45–1:10', 'SaaS 콘솔', '지갑 잔액 +0.05 SOL 변화 → 카탈로그 → 챗 "유아 롬퍼" 7단계 → 리포트 카드'],
        ['1:10–1:35', 'Discord × OpenClaw', '고ROI 알림 임베드 → OpenClaw 핸드오프 페이로드 → 액션'],
        ['1:35–2:00', '강건성', 'ArgoCD 복귀 실연(레플리카 조작→자동 복구) + Grafana 실시간 메트릭'],
        ['2:00–2:35', '실험과 표준', '토큰 -81% · 환각 0% · 타입드 핸드오프 회복 · MPP 준수'],
        ['2:35–3:00', '클로징', '라이브 URL 3종 + GitHub + 슬로건'],
    ],
    [24*mm, 52*mm, 92*mm], H - 54*mm, row_h=15*mm, size=11
)
bullets([
    ('연출 포인트', '① 결제 직전/직후 지갑 잔액 새로고침 (실정산의 직관 증거)  ② solscan의 Memo(externalId) 확대  ③ ArgoCD 복귀는 스피드업 편집 없이 실시간'),
], y=42*mm)
c.showPage()

# ═══════════════════════ S11. 라이브 링크 + 실행 가이드 ═══════════════════════
page_base('10 · 라이브 링크와 실행 가이드', '지금 바로 확인 가능합니다')
table(
    ['항목', '값'],
    [
        ['SaaS Console', 'https://seondal-pay-1064390008895.us-central1.run.app  (계정 evaluator@seondal.demo / seondal2026!)'],
        ['GitHub Repo', 'https://github.com/tteon/seondal-pay (public, README 실행 가이드 포함)'],
        ['Grafana', 'http://34.171.84.231  (admin / seondal-admin)'],
        ['ArgoCD', 'https://136.116.158.227  (admin — docs/ACCESS.md 참조)'],
        ['온체인 증명', 'solscan.io/tx/2VDRaQ9X…BkH?cluster=devnet'],
    ],
    [24*mm, 70*mm], H - 56*mm, row_h=11*mm
)
bullets([
    ('로컬 실행 (README 요약)',
     'git clone → npm install && npm run build → PORT=3000 npx ts-node src/server.ts\n→ npx ts-node scripts/test_mpp_flow.ts (MPP 7종) · scripts/test_mcp_flow.ts (MCP 7종)\n→ .venv/bin/python experiments/exp1_ontology.py (실험 재현)'),
    ('문서', 'docs/TECHNICAL_DEEP_DIVE.md (기술 상세) · EXPERIMENTS.md (실험+감사) · ACCESS.md (계정) · MCP_CLIENT_GUIDE.md'),
], y=H-118*mm)
c.setFillColor(BRAND); c.setFont('KR-B', 15); c.drawString(22*mm, 20*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.save()
print('PDF v2 generated: docs/SEONDAL_Pay_소개서.pdf')
