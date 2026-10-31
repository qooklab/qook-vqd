# 설정 및 배포 가이드

## 1. Supabase
Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/schema.sql` 실행. Project URL과 service_role 키를 복사합니다. 서비스 역할 키는 절대 브라우저에 노출하지 않습니다.

## 2. KIS Open API
한국투자증권 Open API 사용 신청 후 App Key와 App Secret 발급. 국내주식 시세 조회 권한과 호출 한도를 확인합니다.

## 3. OpenDART
https://opendart.fss.or.kr/ 에서 API 키 발급. 현재는 재무제표 조회 함수만 제공되며 기업 코드 매핑 및 자동 재무 평가 연동은 아직 없습니다.

## 4. Vercel
GitHub `qooklab/qook-vqd` 저장소를 Import합니다. Framework는 Next.js, Root Directory는 `./`입니다. Environment Variables에 `.env.example`의 6개 키를 등록합니다. `CRON_SECRET`은 긴 임의 문자열을 사용합니다. 배포 후 Cron 설정을 확인합니다.

## 5. 로컬 실행
`npm install` → `.env.example`을 `.env.local`로 복사 → 환경변수 입력 → `npm run dev`.

## 6. 자동 갱신
`vercel.json`의 `10 7 * * 1-5`는 UTC 기준 평일 07:10, 한국시간 16:10입니다. Vercel 요금제의 Cron 실행 빈도 제한을 확인하세요. 주가 수집이 실패하면 API 응답, KIS 호출 제한, Vercel 실행 시간 제한을 확인하세요.

## 보안
`.env.local`은 Git에 올리지 마세요. 대시보드는 현재 로그인 없이 접근 가능하므로 운영 전 인증/접근 제한을 권장합니다.
