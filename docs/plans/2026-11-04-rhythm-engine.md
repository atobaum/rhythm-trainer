---
created: 2026-11-04
updated: 2026-11-04
status: done
type: plan
feature: rhythm-engine
---

# 리듬 엔진 구현 계획

기능 문서 [[rhythm-engine]] 의 1단계(단일 트랙 4/4)와 2단계(다중 트랙·튜플릿)를 연달아 구현한다. 모든 task 는 TDD 로 하고, task 가 끝날 때마다 검증 명령 `pnpm build && pnpm test && pnpm lint` 를 통과시킨 뒤 커밋한다.

사용자가 "dev 서버로 확인할 수 있을 때까지 계속"하라고 지시해서, 계획 확인을 받은 것으로 보고 바로 구현한다. 확인 수단으로 마지막에 개발용 미리보기 페이지를 붙인다. 이 페이지는 연습 화면 기능([[practice-screen]])이 아니고, 그 기능이 생기면 지운다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/domain/rhythm/fraction.ts` | 기약분수 생성·정규화, 덧셈·뺄셈·곱셈·비교, `"3/8"` 문자열 파싱, 숫자 변환 |
| `src/domain/rhythm/pattern.ts` | 패턴·트랙·이벤트 타입, 불변 조건 검사(`validatePattern` 이 오류 목록 반환), 콘텐츠 JSON 파싱(`parsePattern` 이 위반 시 throw) |
| `src/domain/rhythm/event-generator.ts` | 패턴 + BPM + 시작 시각 + 반복 횟수 → 목표 이벤트 목록 |
| `src/domain/rhythm/polyrhythm.ts` | n:m 비율로 두 트랙 패턴 생성 |
| `src/content/patterns/*.json` | 샘플 패턴. onset·길이는 `"1/8"` 같은 분수 문자열 |
| `scripts/validate-content.ts` | 빌드 전에 콘텐츠 전체를 `validatePattern` 으로 검사. Node 24 의 TypeScript 실행(type stripping)으로 돌린다 |

- 시각 계산은 `(반복 회차 × 패턴 길이 + onset)` 을 분수로 더한 뒤 마지막에 한 번만 `240000 / BPM` 을 곱해 ms 로 바꾼다.
- 모든 트랙은 단성으로 본다. 트랙마다 음표·쉼표가 겹치지 않고 패턴 길이를 빈틈없이 채워야 한다.
- 붙임줄은 같은 `tieGroupId` 를 가진 연속 음표다. 그룹의 첫 음표만 이벤트를 만든다.
- 헛스트로크(`strum.motion = 'ghost'`)와 쉼표는 이벤트를 만들지 않는다.

## Tasks

| # | 단계 | 내용 | 대응 완료 기준 |
|---|---|---|---|
| 1 | 1 | Fraction | 공통 |
| 2 | 1 | 패턴 타입과 불변 조건 검사, 콘텐츠 파싱 | 1단계 1, 5a |
| 3 | 1 | 이벤트 생성기(쉼표, 붙임줄, 헛스트로크, 반복) | 1단계 2, 3, 4, 6 |
| 4 | 1 | 샘플 콘텐츠와 빌드 시 검사 스크립트 | 1단계 5 |
| 5 | 2 | 다중 트랙·튜플릿 검증과 생성 | 2단계 3 |
| 6 | 2 | 폴리리듬 패턴 생성 | 2단계 1, 2 |
| 7 | - | 개발용 미리보기 페이지와 dev 서버 확인 | - |

각 task 끝에 기능 문서 완료 기준 표의 결과 열을 실제 실행 결과로 채운다.
