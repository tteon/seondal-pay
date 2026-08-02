"""Generate the SEONDAL Pay submission deck (PDF, 16:9) from the approved content."""
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = 338.6 * mm, 190.5 * mm  # 16:9 slide
pdfmetrics.registerFont(TTFont('NotoSansKR', '/tmp/NanumGothic.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansKR-Bold', '/tmp/NanumGothic-Bold.ttf'))

INK = HexColor('#0b0b0b'); INK2 = HexColor('#52514e'); INK3 = HexColor('#898781')
BRAND = HexColor('#4f46e5'); BLUE = HexColor('#2a78d6'); GREEN = HexColor('#0ca30c')
LINE = HexColor('#e1e0d9'); BG = HexColor('#fcfcfb'); RED = HexColor('#d03b3b'); AMBER = HexColor('#c98500')

c = canvas.Canvas('docs/SEONDAL_Pay_소개서.pdf', pagesize=(W, H))

def slide_header(kicker, title):
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BRAND); c.setFont('NotoSansKR-Bold', 13); c.drawString(20*mm, H-22*mm, kicker)
    c.setFillColor(INK); c.setFont('NotoSansKR-Bold', 30); c.drawString(20*mm, H-36*mm, title)
    c.setStrokeColor(LINE); c.setLineWidth(0.7); c.line(20*mm, H-42*mm, W-20*mm, H-42*mm)

def bullets(items, x=22*mm, y=None, size=14.5, leading=11*mm, marker_color=BLUE):
    if y is None: y = H - 56*mm
    for m, txt, *rest in items:
        color = rest[0] if rest else marker_color
        c.setFillColor(color); c.setFont('NotoSansKR-Bold', size); c.drawString(x, y, m)
        c.setFillColor(INK); c.setFont('NotoSansKR', size)
        for i, seg in enumerate(txt.split('\n')):
            c.drawString(x + 6*mm, y - i*(leading*0.62), seg)
            if i: y -= leading*0.62
        y -= leading
    return y

def footer(n):
    c.setFillColor(INK3); c.setFont('NotoSansKR', 9)
    c.drawRightString(W-15*mm, 10*mm, f'SEONDAL // Intelligence · {n}')

def metric_row(metrics, y):
    x = 22*mm; wbox = (W - 44*mm) / len(metrics)
    for label, value, color in metrics:
        c.setFillColor(HexColor('#f4f4f2')); c.roundRect(x, y-24*mm, wbox-5*mm, 24*mm, 3*mm, fill=1, stroke=0)
        c.setFillColor(color); c.setFont('NotoSansKR-Bold', 20); c.drawString(x+5*mm, y-12*mm, value)
        c.setFillColor(INK2); c.setFont('NotoSansKR', 10.5); c.drawString(x+5*mm, y-19.5*mm, label)
        x += wbox

# ── 1. 표지 ──────────────────────────────────────────────
c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(BRAND); c.roundRect(20*mm, H-52*mm, 62*mm, 11*mm, 3*mm, fill=1, stroke=0)
c.setFillColor(HexColor('#ffffff')); c.setFont('NotoSansKR-Bold', 13); c.drawCentredString(51*mm, H-48.5*mm, 'HACKATHON SUBMISSION')
c.setFillColor(INK); c.setFont('NotoSansKR-Bold', 46); c.drawString(20*mm, H-78*mm, 'SEONDAL // Intelligence')
c.setFillColor(INK2); c.setFont('NotoSansKR', 20); c.drawString(20*mm, H-92*mm, '에이전트가 스스로 결제하는 크로스볼셀러 소싱 인텔리전스')
c.setFillColor(BLUE); c.setFont('NotoSansKR-Bold', 16); c.drawString(20*mm, H-108*mm, 'Clear Insights, Fair Commerce by SEONDAL')
c.setFillColor(INK2); c.setFont('NotoSansKR', 12.5)
c.drawString(20*mm, 40*mm, '트랙 B — Autonomous On-chain Settlement')
c.drawString(20*mm, 32*mm, 'Solana MPP(draft-solana-charge-00) · GKE Autopilot + ArgoCD · Kimi K3 멀티에이전트 · Coupang↔1688 마진 인텔리전스')
c.setFillColor(INK3); c.setFont('NotoSansKR', 10)
c.drawString(20*mm, 18*mm, 'github.com/tteon/seondal-pay · live: seondal-pay-1064390008895.us-central1.run.app')
footer(1); c.showPage()

# ── 2. 문제 정의 ─────────────────────────────────────────
slide_header('PROBLEM', '정보 비대칭 — 아는 사람만 버는 시장')
bullets([
    ('1', '1688 공장가와 한국 소매가의 격차가 소수 전문 셀러의 암묵지로 존재 —\n초보 셀러는 랜디드코스트(도매·운송·관세)조차 계산할 도구가 없음'),
    ('2', '유용한 소싱 데이터는 있어도 기계가 즉시 살 수단이 없음 —\nPG/구독/API키는 전부 사람 전제, AI 에이전트가 가입·결제할 수 없음'),
    ('3', '플랫폼이 원화를 예치하면 전자금융거래법 PG 등록 의무(§28) —\n에이전트 커머스의 법적 구조가 비어 있음'),
    ('4', '크롤링 원문(노이즈 99%)을 에이전트에 넣으면 환각이 연쇄 증폭 —\nA2A 간 품질 검증 없는 데이터 전달의 한계'),
    ('5', '쿠팡 시장의 구조(파이·인컴턴트 마진)를 모르고 진입하면\n마진 없는 카테고리에서 소모전 — 진입 판정 데이터 부재'),
])
metric_row([('정보 격차 사례', '₩32K -> ₩56K', BRAND), ('초기 셀러 자본', '₩300만', BLUE), ('크롤링 노이즈', '99%', RED)], 34*mm)
footer(2); c.showPage()

# ── 3. 솔루션 개요 ───────────────────────────────────────
slide_header('SOLUTION', '에이전트가 판단하고, 온체인으로 정산한다')
bullets([
    ('1)', 'MPP 표준 결제 레이어 — HTTP 402 + Solana로 계정 없는 M2M 즉시 결제\n(draft-solana-charge-00 구현: 챌린지·크리덴셜·영수증·TTL·리플레이 차단)'),
    ('2)', '자율 결제 에이전트 — 예산 정책(≤0.06 SOL)을 스스로 검토하고\n지갑 서명·devnet 전송·영수증 수신까지 사람 승인 없이 수행'),
    ('3)', '온톨로지 노이즈 감소 — 원문 -> schema.org/Product 정합 JSON-LD 노드만 A2A 전달\n(AGENT.md Rule 2.1) -> 토큰 -81%, 환각 0% (실측)'),
    ('4)', '쿠팡 판매자 추정 경제 — 실측 소매가 - 수수료(10.8%) - 배송 vs 랜디드코스트\n-> 마켓 파이와 진입 마진 희생을 계산해 SEONDAL 유저에게 가이드'),
    ('5)', '실운영 GitOps — GKE Autopilot + ArgoCD app-of-apps,\nPrometheus/Grafana/Loki/Tempo 관찰성, Discord 알림 -> OpenClaw 핸드오프'),
])
footer(3); c.showPage()

# ── 4. 핵심 프로세스 ─────────────────────────────────────
slide_header('PROCESS', '0.05 SOL 결제부터 리포트까지 8단계')
steps = [
    ('1', '402 챌린지', 'WWW-Authenticate: Payment (JCS+base64url, TTL 300s)'),
    ('2', '정책 검증', '에이전트가 예산 한도 자율 판단 (무승인)'),
    ('3', '서명·전송', 'SOL transfer + Memo(externalId) -> devnet'),
    ('4', '온체인 검증', '금액·수신자·메모 바인딩 + 리플레이 차단'),
    ('5', '영수증', 'Payment-Receipt 발행 (MPP §11.6)'),
    ('6', '크롤링·타이핑', 'JSON-LD 노드 -> GCS + Cloud SQL(JSONB)'),
    ('7', '마진 분석', '쿠팡 실측 - 수수료 - 배송 vs 랜디드코스트'),
    ('8', '라우팅·알림', '관심 프로파일 매칭 -> Discord -> OpenClaw'),
]
y = H - 56*mm
for n, t, d in steps:
    c.setFillColor(BLUE); c.circle(25*mm, y+2*mm, 3.2*mm, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('NotoSansKR-Bold', 11); c.drawCentredString(25*mm, y+0.8*mm, n)
    c.setFillColor(INK); c.setFont('NotoSansKR-Bold', 14); c.drawString(32*mm, y+3*mm, t)
    c.setFillColor(INK2); c.setFont('NotoSansKR', 12); c.drawString(32*mm, y-3*mm, d)
    y -= 15.5*mm
footer(4); c.showPage()

# ── 5. 실험 검증 ─────────────────────────────────────────
slide_header('PROOF', '주장이 아니라 측정 — 사전 등록 실험 2종')
metric_row([
    ('토큰 절감 (온톨로지)', '-81.4%', GREEN),
    ('팩트 정확도', '98% vs 91%', BLUE),
    ('환각률', '0% vs 9%', GREEN),
    ('추정 비용', '-40.1%', BRAND),
], H-78*mm)
bullets([
    ('E1', '온톨로지 효용성 (200 calls, Kimi K3, 조걳별 별도 빌링 키)\n원시 텍스트 vs JSON-LD 노드 — 사전 등록 3개 기준 전부 충족 O'),
    ('E2', '멀티에이전트 (openai-agents SDK)\n자유 텍스트 핸드오프 50% (맥락 소실) -> 타입드 JSON 핸드오프 90% 회복\n-> "타입드 노드로만 소통하는 멀티에이전트" Rule 2.1의 실증'),
    ('●', '독립 감사 트레일 — 재집계 일치, 200개 유일 trace_id, 응답 캡처로\n환각 메커니즘(디스트랙터 오인용) 육안 확인 (docs/EXPERIMENTS.md)'),
], y=H-116*mm)
footer(5); c.showPage()

# ── 6. MPP 표준 준수 ─────────────────────────────────────
slide_header('STANDARD', 'MPP (draft-solana-charge-00) 와이어 호환')
rows = [
    ('WWW-Authenticate: Payment 챌린지 (JCS+base64url)', 'OK'),
    ('charge request: lamports·currency·recipient·externalId', 'OK'),
    ('externalId -> 온체인 Memo instruction 바인딩', 'OK'),
    ('Authorization: Payment 크리덴셜 (push mode)', 'OK'),
    ('Payment-Receipt 헤더', 'OK'),
    ('expires TTL 강제 · 리플레이 차단 (atomic)', 'OK'),
    ('RFC 9457 problem+json + 새 챌린지', 'OK'),
    ('pull mode / SPL-USDC / facilitator', '로드맵'),
]
y = H - 54*mm
for k, v in rows:
    c.setFillColor(GREEN if v == 'OK' else AMBER); c.setFont('NotoSansKR-Bold', 13); c.drawString(24*mm, y, v)
    c.setFillColor(INK); c.setFont('NotoSansKR', 13); c.drawString(44*mm, y, k)
    y -= 10.5*mm
c.setFillColor(INK2); c.setFont('NotoSansKR', 11)
c.drawString(24*mm, y-2*mm, '+ 레거시 X-Payment-* (x402 스타일) 헤더 병행 — 기존 클라이언트 무중단. 테스트 7종 통과 (scripts/test_mpp_flow.ts)')
footer(6); c.showPage()

# ── 7. 아키텍처 ──────────────────────────────────────────
slide_header('ARCHITECTURE', 'GitHub가 진실의 원천 — ArgoCD가 GKE를 운영')
bullets([
    ('●', 'GKE Autopilot (us-central1): seondal-pay ×2 (LoadBalancer)\n+ Cloud SQL Auth Proxy 사이드카 -> PostgreSQL products(JSONB+GIN)'),
    ('●', 'ArgoCD app-of-apps: seondal-pay + kube-prometheus-stack +\nloki + tempo + otel-collector — drift 자동 복구 (실연 검증)'),
    ('●', '관찰성 풀스택: /metrics(Prometheus) · JSON 로그 trace_id(Loki) ·\nOTLP 트레이스(Tempo) · Alertmanager -> Discord'),
    ('●', 'Solana devnet: MPP 챌린지/검증/영수증 — 무수탁(Zero-Custody) 정산'),
    ('●', 'Cloud Run SaaS Console: 평가자 접속면 (챗·마켓 파이·지갑 실시간)'),
    ('●', '시크릿 제로 커밋 — K8s Secret/Secret Manager 주입, ODK 온톨로지 버저닝'),
])
footer(7); c.showPage()

# ── 8. 비즈니스 모델 ─────────────────────────────────────
slide_header('BUSINESS', '데이터가 팔릴 때마다 0.005~0.05 SOL')
bullets([
    ('T1', '0.005 SOL — 기본 메타데이터 (카탈로그·검색)'),
    ('T2', '0.015 SOL — 물류·도매 스펙 (MOQ·무게·랜디드 요소)'),
    ('T3', '0.050 SOL — 쿠팡 벤치마크·판매자 추정 경제·ROI·프로파일 라우팅'),
    ('->', '결제 금액 = 데이터 접근 깊이 (서버 측 페이로드 필터링으로 강제)'),
    ('+', '확장: 컴패레이터 프리미엄 피드(프로파일 알림) · 파트너 데이터 스토어(수수료 15%) ·\n엔터프라이즈 프라이빗 배포(소싱 에이전시)'),
    ('₩', '단위경제: SOL 수수료 ~0.000005/tx — 결제 자체가 사용 증거이자 매출 지표'),
])
metric_row([('Tier 1', '0.005 SOL', BLUE), ('Tier 2', '0.015 SOL', BRAND), ('Tier 3', '0.050 SOL', GREEN)], 34*mm)
footer(8); c.showPage()

# ── 9. 시장 분석 ─────────────────────────────────────────
slide_header('MARKET INTEL', '마켓 파이 + 진입 마진 — 10개 카테고리 실측 분석')
rows = [
    ('수유등', '₩4,793', '170.5%', 'O', GREEN),
    ('아기 수건', '₩3,231', '52.9%', 'O', GREEN),
    ('미니 선풍기', '₩4,090', '42.6%', 'O', GREEN),
    ('요가매트', '₩10,689', '13.0%', '△', AMBER),
    ('롬퍼', '₩4,805', '2.8%', 'X', RED),
    ('기저귀 가방', '₩8,244', '-29.3%', 'X', RED),
    ('아기 간식', '₩3,397', '-59.6%', 'X', RED),
]
c.setFont('NotoSansKR-Bold', 12); c.setFillColor(INK3)
c.drawString(24*mm, H-54*mm, '카테고리'); c.drawString(90*mm, H-54*mm, '우리 랜디드코스트'); c.drawString(150*mm, H-54*mm, '최저가 진입 ROI'); c.drawString(200*mm, H-54*mm, '판정')
y = H-64*mm
for cat, lc, roi, v, color in rows:
    c.setFillColor(INK); c.setFont('NotoSansKR', 12.5); c.drawString(24*mm, y, cat)
    c.drawString(90*mm, y, lc); c.drawString(150*mm, y, roi)
    c.setFillColor(color); c.setFont('NotoSansKR-Bold', 12.5); c.drawString(200*mm, y, v)
    y -= 9.5*mm
c.setFillColor(INK2); c.setFont('NotoSansKR', 11)
c.drawString(24*mm, y-3*mm, '쿠팡 실측가 - 수수료(10.8%) - 배송 vs 1688 랜디드코스트 -> "어느 시장에, 마진 얼마를 줄여 진입할지" 계산으로 제시')
footer(9); c.showPage()

# ── 10. 멀티에이전트 협업 ────────────────────────────────
slide_header('AGENT OPS', '이 인프라는 에이전트들이 협업해 배포했다')
bullets([
    ('C', 'Claude — 오케스트레이션 · MPP 프로토콜 구현 · 실험 설계/감사 · 도메인 로직'),
    ('G', 'agy(Gemini) — GCP 네이티브 작업: IAM 실패 원인 분석->에스컬레이션,\nbootstrap 버그 자율 수정, 시크릿 생성, ArgoCD 적용, Cloud Run 배포'),
    ('O', 'OpenClaw (사용자 로컬) — 쿠팡 브라우저 실측 수집 -> /api/ingest/coupang-price\n(residential IP로 안티봇 통과, 데이터센터 차단 우회)'),
    ('->', '협업 프로토콜: 미션 브리프 -> 자율 실행 -> 구조화 보고 -> 검증/커밋\n= 우리가 파는 것(A2A 자동화)을 우리가 이미 살고 있다는 증거'),
])
footer(10); c.showPage()

# ── 11. 로드맵·링크 ──────────────────────────────────────
slide_header('NEXT', '로드맵과 라이브 링크')
bullets([
    ('1', 'Coupang Partners 승인 -> 마켓 전체 실측가 API 전환 (코드 완비, 키 교체 즉시)'),
    ('2', 'MPP pull mode · SPL/USDC 정산 · facilitator 분리 (x402 v2)'),
    ('3', 'ODK ROBOT QC CI · 온톨로지 릴리스 파이프라인 · Python AI 추론 pod'),
    ('4', 'pay.sh 스킬 마켓플레이스 · 다중 체인 · 엔터프라이즈 프라이빗 배포'),
])
c.setFillColor(INK); c.setFont('NotoSansKR-Bold', 15); c.drawString(22*mm, H-110*mm, 'Live Links')
c.setFont('NotoSansKR', 12.5); c.setFillColor(BLUE)
for i, (label, url) in enumerate([
    ('SaaS Console (평가자 계정 제공)', 'https://seondal-pay-1064390008895.us-central1.run.app'),
    ('GitHub Repo', 'https://github.com/tteon/seondal-pay'),
    ('Grafana', 'http://34.171.84.231'),
    ('ArgoCD', 'https://136.116.158.227'),
    ('On-chain proof (devnet tx)', 'solscan.io/tx/2VDRaQ9X…BkH?cluster=devnet'),
]):
    c.drawString(26*mm, H-120*mm-i*8.5*mm, f'{label} — {url}')
c.setFillColor(BRAND); c.setFont('NotoSansKR-Bold', 15)
c.drawString(22*mm, 22*mm, 'Clear Insights, Fair Commerce by SEONDAL')
footer(11)

c.save()
print('PDF generated: docs/SEONDAL_Pay_소개서.pdf')
