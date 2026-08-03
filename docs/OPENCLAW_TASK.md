# OpenClaw 태스크: 쿠팡 실데이터 수집 → SEONDAL ingest

아래 10개 키워드에 대해 쿠팡 검색 결과 상위 5개 상품의 정보를 수집해서
각각 POST로 전송하라.

## 대상 키워드 (10개)
롬퍼, 실리콘 식기, 치발기, 아기 샴푸, 아기 수건, 수유등, 요가매트, 아기 간식, 미니 선풍기, 기저귀 가방

## 절차 (키워드당 반복)
1. 브라우저로 https://www.coupang.com/np/search?q=<키워드> 접속
2. 상위 5개 상품에 대해 추출:
   - productName: 상품명 (텍스트)
   - priceKrw: 현재 판매가 (숫자만, 쉼표 제거)
   - monthlySales: "월 몇백/몇천개 판매" 표시가 있으면 그 숫자 (없으면 리뷰 수를 reviewCount에)
   - reviewCount: 리뷰 수 (있으면)
   - url: 상품 링크
3. 각 상품을 즉시 전송:
   POST https://seondal-pay-1064390008895.us-central1.run.app/api/ingest/coupang-price
   Content-Type: application/json
   {
     "productName": "...",
     "priceKrw": 12900,
     "monthlySales": 1840,
     "reviewCount": 523,
     "category": "<키워드>",
     "url": "https://www.coupang.com/vp/products/...",
     "source": "openclaw"
   }

## 규칙
- 키워드 간 3초 대기, 상품 간 1초 대기 (rate limit 방지)
- 실패한 상품은 건너뛰고 마지막에 실패 목록 보고
- 완료 후 키워드별 전송 건수 요약 보고
