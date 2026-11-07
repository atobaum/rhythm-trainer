---
created: 2026-11-05
updated: 2026-11-05
status: done
type: plan
feature: quick-practice, dictation, guitar-strumming, two-hand, polyrhythm
---

# 남은 기능 구현 계획

사용자가 계획한 기능을 모두 끝낼 때까지 이어서 하라고 했다. 대상은 [[quick-practice]], [[dictation]], [[guitar-strumming]], [[two-hand]], [[polyrhythm]]이다. 기능마다 구현, 테스트, 브라우저 확인, 커밋 순서로 간다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/domain/practice/skill.ts`, `streak.ts` | 음형별 최근 점수와 약함, 연속 연습 일수 |
| `src/domain/curriculum/quick-curation.ts` | 기록·진도·세션 이력으로 다음 문제 종류와 패턴을 고름 |
| `src/domain/dictation/dictation.ts` | 소리 나는 시점 기준 리듬 비교, 선택지·완성하기 문제 생성, 박별 채점 |
| `src/domain/rhythm/strum-patterns.ts` | 슬롯 기호 문자열로 스트로크 패턴 생성 |
| `src/domain/evaluation/matcher.ts`, `metrics.ts` | 탭 방향과 방향 틀림 수 |
| `src/domain/rhythm/two-hand-patterns.ts`, `evaluation/hand-stats.ts` | 양손 패턴, 한 손 연습, 손별 지표와 두 손 간격 |
| `src/infrastructure/notation/score-renderer.ts` | 트랙마다 한 줄, 같은 시점을 세로로 맞춘 여러 줄 악보 |
| `src/presentation/tap-zones.ts` | 패턴과 설정에 맞는 입력 영역(한 영역, 다운·업, 왼손·오른손)과 키 |
| `src/presentation/pages/DictationScreen.tsx` | 청음 화면 |
| `src/presentation/pattern-lists.ts` | 자유 연습 목록(고정, 스트로크, 양손, 폴리리듬) |

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | 빠른 연습 카드, 시간제 세션, 문제 고르기, 실력 기록, 연속 기록 | 단위 테스트, Chrome 에서 시작·다음 문제·요약 |
| 2 | 청음 악보 고르기·완성하기 | 단위 테스트, Chrome 에서 제출과 박별 표시 |
| 3 | 스트로크 패턴, 좌우 방향 입력, 방향 판정, 다운·업 소리 | 단위 테스트, Chrome 에서 방향 틀림 표시 |
| 4 | 양손 패턴, 여러 줄 악보, 손별 입력·타이밍 트랙·결과 | 단위 테스트, Chrome 에서 동시 입력 |
| 5 | 폴리리듬 목록과 직접 지정 | 렌더링 전수 확인, Chrome 에서 2:3 연주 |
| 6 | 휴대폰 폭 화면, 기능 문서 완료 기준 | Chrome 390 폭 프레임 |

각 task 마다 `pnpm build && pnpm test && pnpm lint` 를 통과시키고 커밋했다.
