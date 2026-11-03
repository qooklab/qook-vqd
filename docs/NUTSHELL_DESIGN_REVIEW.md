# 종목 리서치 화면 — Nutshell Apple Design Skill

**Purpose:** 국내 등록 종목을 시세·점수·평가 범위로 비교하고 상세 평가로 이동한다.
**Platform(s):** 반응형 Next.js 웹. iOS/iPadOS/macOS용 HIG의 정보 계층·검색·목록·상태 원칙을 웹에 맞게 적용한다. 네이티브 시스템 UI나 HIG 완전 준수를 주장하지 않는다.
**Skill:** https://github.com/NutshellEngineering/apple-design-skill/blob/main/skills/apple-design-skill/SKILL.md

## Navigation shell

기존 두 메뉴와 현재 위치 표시를 유지한다. 큰 소개 문구와 V/Q/D 소개 카드를 제거하고 짧은 화면 제목·수집 상태·평가 기준 링크로 구성한다. 이 제품은 두 메뉴뿐이므로 사이드바를 추가하지 않는다.

근거: `references/getting-started/design-principles.md`의 Agency, Simplicity. 작업 중심 화면에 필요한 정보만 남기는 구성은 이 웹사이트에 대한 설계 판단이다.

## Primary content

- `references/components/layout-and-organization/lists-and-tables.md`를 바탕으로 숫자 정렬·텍스트 열·교차 행 구분을 유지한다.
- 데스크톱은 높이 제한이 있는 표와 고정 열 제목, 모바일은 묶음 목록으로 표현한다. 표의 680px 최대 높이와 간격 수치는 웹사이트 구현 선택이다.
- 기존 점수 계산과 '확인 점수 / 전체 100점', 별도의 평가 가능 배점을 유지한다.

## Supporting patterns

- `references/patterns/searching.md`: 목록 바로 앞에 검색을 배치하고 검색어 지우기·Escape 초기화를 유지한다. 시각적 순서와 키보드 탐색 순서를 일치시킨다.
- `references/components/selection-and-input/segmented-controls.md`: 전체·평가 완료·일부 평가·미평가를 관련된 네 가지 선택지로 묶는다. 각 상태의 등록 종목 수를 함께 표시한다. 검색 결과 수는 검색창에 따로 표시한다.
- 단일 선택은 네이티브 radio 입력으로 구현해 방향키를 지원한다. 선택 범주를 바꾸어도 검색어는 유지한다.
- `references/patterns/loading.md`: Next.js 로딩 경계에 명시적인 읽기 상태와 실제 데이터 형태를 닮은 정적 자리 표시자를 추가한다. 임의 숫자나 예상 소요 시간은 표시하지 않는다.
- `references/foundations/materials.md`: 자료를 읽는 콘텐츠 표면은 불투명하게 유지한다. 새 유리 효과는 도입하지 않는다.
- `references/foundations/motion.md`: 반복적인 검색·필터에 추가 애니메이션을 넣지 않는다.

## States

- **Loading:** 페이지 제목과 로딩 상태, 요약/행 자리 표시자. 메뉴와 평가 기준으로 이동할 수 있다.
- **Empty:** 검색 조건 또는 평가 상태에 따라 안내를 구분하고 전체 종목으로 초기화한다.
- **Error:** 예상하지 못한 렌더링/조회 예외는 원문 오류나 내부 정보를 노출하지 않고 '다시 시도'와 홈 이동을 제공한다.
- **Populated:** 수집된 값만 표시하고 미수집·미산정·미평가를 구분한다.

## Accessibility

기존 12px 상당 이상 rem 텍스트, 44px 조작 영역, 키보드 포커스, 색상 외 상태 문구, 시스템 다크 모드, 고대비·모션 감소 대응을 유지한다. radio 그룹에는 설명 가능한 이름을 제공하고 관련 상태 수를 읽을 수 있게 한다. 로딩 상태는 `role="status"`, 자리 표시자는 `aria-hidden`을 사용한다.

## Implementation note

이 문서는 HIG에 근거한 디자인 의도를 설명한다. 정확한 API 이름은 HIG에서 추정하지 않는다. 네이티브 SwiftUI/UIKit 구현을 흉내내는 대신 HTML·CSS·React·기존 Next.js 파일 규칙을 사용한다. KIS/DART/Supabase·인증·평가 계산·수동 갱신 로직과 의존성 선언은 변경하지 않았다.

## Validation

- 타입 검사·프로덕션 빌드 통과.
- 실제 브라우저: 미평가 필터 + 삼성전자 검색 결과 2종목, 005930 검색 결과 1종목, 전체 종목 초기화, 방향키 상태 전환, 종목 상세 이동 확인.
- 다크 모드 데스크톱과 390px/320px 모바일 검수. 두 모바일 너비 모두 문서 가로 넘침 없음. 콘솔 오류 없음.
- 데이터 없음·일부 평가·완료 상태 및 상태별 건수는 React 렌더링 검사로 확인.
- 로딩·오류 컴포넌트는 렌더링 검사로 확인. 실제 지연 또는 서버 예외를 강제 발생시키는 검증은 하지 않았다.
- API 키가 없어 실데이터 수집과 인증 갱신은 검증하지 않았다. 라이트 모드·200% 글자 확대의 시각 검수는 미완료다.
