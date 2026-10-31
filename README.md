# Qook VQD

국내 30종목의 저평가·우량·배당주 모니터링을 위한 Next.js + Supabase 프로젝트.

- KIS API: 국내주식 현재가, PER, PBR 수집
- Supabase: 최신 시세 저장
- Vercel Cron: 평일 자동 갱신
- OpenDART: 재무제표 조회 유틸리티
- 종목별 부분 평가점수 및 상세 화면

**미구현:** 10개 평가항목의 완전 자동화, 적정매수가 자동 계산, 가격 알림. API 키를 설정하기 전에는 실제 시세가 표시되지 않습니다.

## 시작
1. `npm install`
2. `.env.example`을 `.env.local`로 복사하고 API 키 설정
3. Supabase SQL Editor에서 `supabase/schema.sql` 실행
4. `npm run dev`
5. GitHub 저장소를 Vercel에 Import하고 환경변수 등록

문서: [프로젝트 구성](docs/PROJECT_GUIDE.md) · [설정 및 배포](docs/SETUP_GUIDE.md)

API 키는 GitHub에 올리지 마세요.