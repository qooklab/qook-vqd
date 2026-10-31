# 프로젝트 구성 가이드

- `app/page.tsx`: 30종목 대시보드
- `app/stocks/[code]/page.tsx`: 종목별 상세 화면
- `app/api/cron/route.ts`: KIS 시세 수집 API (CRON_SECRET 필수)
- `lib/stocks.ts`: 30종목 목록, 10개 평가항목, 부분 점수 계산
- `lib/kis.ts`: 한국투자증권 시세 API
- `lib/dart.ts`: OpenDART 재무제표 조회 함수 (자동 수집 미연결)
- `lib/db.ts`: 서버 전용 Supabase 연결
- `supabase/schema.sql`: 데이터베이스 구조
- `vercel.json`: 평일 07:10 UTC(16:10 KST) 실행

## 데이터 정확성
미확인 항목은 미평가로 남깁니다. PER/PBR 기반 부분점수만 자동 갱신되며 전체 100점 점수, 적정매수가 산정, 배당·공시 자동 반영은 추가 구현이 필요합니다.
