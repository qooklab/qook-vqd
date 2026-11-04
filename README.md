# Qook VQD

국내 주식의 **가치(Value)·퀄리티(Quality)·배당(Dividend)** 지표를 한 화면에서 살펴보는 개인용 분석 대시보드입니다.

- 서비스: https://qook-vqd.vercel.app/
- 기술: Next.js 15, React 19, TypeScript, Supabase, Vercel
- 시세 출처: 한국투자증권(KIS) Open API
- 재무정보 출처: 금융감독원 OpenDART

> 점수는 이 프로젝트에서 정의한 자체 평가 규칙에 따른 참고 지표입니다. 투자 권유나 수익 보장이 아닙니다. 일부 평가 항목은 자동 수집되지 않거나 미산정 상태일 수 있습니다.

## 추가 평가 연결

안전마진·모형 매수기준, 5년 배당 이력, 실제 자사주 소각, 3년 수익성 대리지표를 연결했습니다. 목록은 화면 표시 후 최대 3종목씩 자동 수집하며, 상세 화면은 개별 종목을 자동 갱신합니다. DART 관리 버튼으로 통합 평가를 수동 갱신할 수도 있습니다. 신규 SQL 실행은 필요하지 않습니다.

정상 공시 결과는 7일, 일부 조회 오류 결과는 15분 재사용하고 가격 관련 지표는 최신 수집가로 재계산합니다. 자료가 없으면 0점으로 채우지 않고 상세 화면에 사유를 표시합니다. 금융업 건전성 지표는 별도 기준 연결 전까지 미평가입니다. 산식·출처·한계는 [추가 평가 설명](docs/RESEARCH_SCORING.md)을 참고하세요.

## 주요 기능

- 등록된 30개 국내 종목의 주가·PER·PBR 등 조회
- 종목별 상세 평가 및 평가 기준 페이지
- 선택 종목 수동 시세 갱신
- DART 사업보고서 3개년을 이용한 이익 안정성·재무 건전성·이익 성장 평가
- Supabase 기반 데이터 보관 및 DART 결과 캐싱

## 데이터 수집 및 갱신

| 구분 | 출처 | 동작 |
| --- | --- | --- |
| 주가, PER, PBR 등 | KIS | 기존 시세 갱신 경로에서 수집 |
| 재무 평가 | OpenDART | 수동 재무평가 시 수집, 성공 결과 7일 캐싱 |
| DART 기업 고유번호 | FSS 공식 기업 검색 대조 | 등록 30종목은 검증된 매핑 사용, 전체 ZIP 다운로드 생략 |

**KIS 시세 갱신과 DART 재무평가는 서로 다른 동작**입니다. DART 재무평가 버튼은 시세 API를 호출하지 않습니다. 재무제표는 최근 3개 완료 사업연도의 연결 재무제표를 우선 조회합니다. 연결 자료가 없는 경우에는 3개년 전체를 별도 재무제표로 다시 조회하며, 서로 다른 기준을 혼합하지 않습니다. 금융업의 재무 건전성은 일반기업 부채비율 산식으로 평가하지 않습니다.

기존 3개 재무점수 전용 API의 DART 캐시는 **수동 재무평가가 실행될 때** 활용됩니다. 추가 통합 평가의 자동 수집·캐시 동작은 위 추가 평가 설명을 따릅니다. 점수가 없는 결과는 7일 캐시로 재사용하지 않으며, 이전 처리 버전의 캐시는 다음 조회 때 다시 계산합니다. 성공 후 화면의 ‘DART 평가 결과 보기’에서 조회 연도와 연결/별도 기준을 확인할 수 있습니다. 모든 신규 공시를 실시간 감시하는 기능은 없으며, 추가 통합 평가 자동 수집은 목록·상세 방문 시 실행됩니다.

## 설치 및 실행

Node.js 환경에서:

```bash
npm install
npm run dev
```

개발 서버: http://localhost:3000

검증:

```bash
npm run typecheck
npm run build
```

## 환경변수

프로젝트 루트의 `.env.local` 또는 Vercel 프로젝트의 환경변수에 설정합니다.

```dotenv
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
KIS_APP_KEY=
KIS_APP_SECRET=
DART_API_KEY=
CRON_SECRET=
```

- `SUPABASE_SERVICE_ROLE_KEY`와 `CRON_SECRET`은 **서버 전용 비밀값**입니다. `NEXT_PUBLIC_` 접두사를 붙이거나 Git에 커밋하지 마세요.
- KIS 및 DART API 키는 각 제공 기관에서 발급받아야 합니다.
- 환경변수 변경 후에는 Vercel 재배포가 필요할 수 있습니다.

## Supabase 데이터베이스 설정

Supabase 대시보드 → **SQL Editor**에서 저장소의 다음 SQL을 실행합니다.

1. [supabase/schema.sql](supabase/schema.sql): 종목 최신 데이터 및 시세 이력 테이블
2. [supabase/kis_token_cache.sql](supabase/kis_token_cache.sql): KIS 토큰 캐시 및 발급 잠금
3. [supabase/dart_cache.sql](supabase/dart_cache.sql): DART 재무평가 7일 캐시 및 기업코드 30일 캐시

**주의:** `CREATE TABLE IF NOT EXISTS`는 기존 테이블에 새 컬럼을 자동 추가하지 않습니다. 과거 스키마로 생성한 DB라면 현재 `schema.sql`의 컬럼과 실제 테이블 구조가 일치하는지 확인하고 필요한 마이그레이션을 별도로 적용해야 합니다.

## 수동 갱신

1. 웹 화면에서 종목을 선택합니다.
2. `CRON_SECRET`을 입력합니다.
3. **선택한 종목 갱신**을 누르면 KIS 시세를 갱신합니다.
4. **선택 종목 DART 재무평가**를 누르면 재무점수를 갱신합니다.

시세 요청은 KIS 호출 제한을 고려해 종목 사이에 1.5초 간격을 두며, 호출 제한 시 재시도합니다. DART 전용 평가는 해당 시세 대기 시간을 사용하지 않습니다.

## 주요 코드

| 경로 | 역할 |
| --- | --- |
| `app/page.tsx` | 종목 대시보드 |
| `app/stocks/[code]/page.tsx` | 종목 상세 |
| `app/manual-refresh.tsx` | 수동 갱신 UI |
| `app/api/refresh/route.ts` | 인증된 단일 종목 수동 갱신 API |
| `app/api/cron/route.ts` | 인증된 시세 일괄 갱신 API |
| `lib/kis.ts` | KIS API 연동 |
| `lib/dart.ts` | DART 기업코드 및 재무제표 조회 |
| `lib/financial-score.ts` | DART 재무평가 및 캐시 |
| `lib/stocks.ts` | 종목 목록 및 평가 규칙 |
| `lib/db.ts` | Supabase 서버 클라이언트 |

## 오류 해결

| 증상 | 확인할 내용 |
| --- | --- |
| `DART 캐시 테이블 미설정` | `supabase/dart_cache.sql` 실행 여부 |
| `DART 기업코드 캐시 테이블 미설정` | 동일 SQL 실행 여부 |
| `DART 기업목록 API ...` | DART 키, API 이용 제한 및 응답 코드 |
| `서버 오류 (HTTP 500)` 또는 시간 초과 | Vercel 프로젝트 → Logs / Functions에서 실제 오류 확인 |
| `재무점수 미산정` | 해당 종목의 DART 보고서·계정과목 제공 여부 |
| `인증 실패` | 입력한 `CRON_SECRET`과 Vercel 설정 일치 여부 |
| Supabase 컬럼 오류 | 기존 DB 스키마와 최신 `schema.sql` 비교 |

Vercel의 새 배포가 **Ready**인지 확인한 뒤 한 종목부터 시험하세요. GitHub 커밋만으로 실제 배포 및 API 정상 동작이 검증되는 것은 아닙니다.

## 보안

이 프로젝트는 서버에서 Supabase 서비스 역할 키 및 외부 API 비밀키를 사용합니다. 키를 브라우저 코드에 노출하지 마세요. 수동 갱신 인증키는 입력 화면에서만 사용하며 브라우저 저장소에 보관하지 않도록 구현되어 있습니다.

