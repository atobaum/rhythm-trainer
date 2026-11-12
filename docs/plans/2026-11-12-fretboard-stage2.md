---
created: 2026-11-12
updated: 2026-11-12
status: done
type: plan
feature: fretboard
---

# 지판 외우기 2단계 구현 계획

[[fretboard#7.2 2단계]] 를 구현한다. 정답 음 소리, 위치별 기록, 약한 위치 가중 출제.

## 코드 수준 설계

| 모듈 | 바뀌는 것 |
|---|---|
| `src/domain/fretboard/fretboard.ts` | `frequencyAt(position)` 추가. 개방현 MIDI 번호(6번줄 E2 = 40 부터 1번줄 E4 = 64)에 프렛 수를 더하고 A4 = 69 = 440Hz 평균율로 바꾼다 |
| `src/domain/fretboard/position-records.ts` (새 파일) | 기록 단위 키(`name-the-note` 는 줄·프렛, `find-the-position` 은 줄·음), 최근 기록 목록(정오답, 응답 ms, 최대 5개), 세션 답 목록을 기록에 더하는 함수, 가중치 함수(1 + 2 × 오답 + 3초 넘은 정답, 기록 없음 3), 칸 상태 함수(`strong` / `shaky` / `weak` / 없음), 칸 위치에서 방식별 기록 키를 구하는 함수 |
| `src/domain/fretboard/questions.ts` | `nextQuestion` 이 문제 → 가중치 함수를 받는다(기본은 모두 1). 음 보고 위치 찍기 후보를 줄 × 음 전체로 펼치고, 줄을 먼저 고르게 뽑던 1/(줄 수 × 음 수) 가중치를 없앤다. 직전 문제 제외 규칙은 그대로 |
| `src/presentation/fretboard-records.ts` (새 파일) | 기록 저장·읽기·지우기. 키 `rhythm-lab.fretboard-records.v1`. 모양이 맞지 않는 항목은 버리고 읽는다 |
| `src/presentation/fretboard-settings.ts` | `soundEnabled`(기본 `true`) 추가. 기존 저장값에 없으면 기본값 |
| `src/infrastructure/audio/audio-engine.ts` | `playNow(kind, frequency?)`. 주파수를 넘기면 그 높이로 낸다. 기존 호출은 그대로 |
| `src/presentation/components/Fretboard.tsx` | `cellTones` prop. 위치별 상태를 받아 칸 배경에 초록·노랑·빨강을 옅게 칠한다. 줄·인레이·표시보다 아래에 그린다 |
| `src/presentation/pages/FretboardApp.tsx` | 설정 화면에 소리 켜기/끄기, 기록 지우기(`window.confirm` 한 번), 미리 보기 지판에 고른 방식의 칸 상태. 시작 버튼에서 `audioEngine.unlock()`. 답하면 소리 켬일 때 정답 위치 음을 낸다(음 보고 위치 찍기는 찍은 곳이 정답이면 그곳, 아니면 낮은 프렛). 출제에 기록 기반 가중치를 넘긴다. 결과로 넘어갈 때 기록에 더해 저장하고, 그만두기는 저장하지 않는다 |

- 세션 중 가중치는 시작할 때 읽은 기록으로 고정한다. 세션 안에서 방금 틀린 문제가 곧바로 다시 몰려 나오지 않게 하려는 것이다.
- 칸 상태 색은 설정 화면에서만 보인다. 문제 화면에는 칠하지 않는다(답을 암시하므로).

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | `frequencyAt`, `position-records.ts`, 가중치를 받는 `nextQuestion` 과 단위 테스트. 6번줄 5프렛 110Hz, 1번줄 0프렛 329.6Hz, 최근 5개만 남기기, 가중치·칸 상태 경계값(오답 1·2번, 평균 3초), 한 위치만 오답 5번 기록으로 시드 고정 1000번 출제 시 그 위치 빈도가 고르게 뽑을 때보다 높고 연속 같은 문제 없음(완료 기준 5) | `pnpm build && pnpm test && pnpm lint` |
| 2 | 기록 저장소, `soundEnabled` 설정, `playNow` 주파수 인자. 저장값 정규화 테스트 | 같은 명령 |
| 3 | 지판 칸 색, 설정 화면(소리, 기록 지우기, 칸 상태), 문제 화면 소리와 가중 출제, 결과 때 기록 저장 | 같은 명령. Ego Lite 390×844 에서 완료 기준 1~4, 6 확인. 소리 높이(1행)는 오실레이터 주파수 값으로 확인하고 귀로 듣는 확인은 사용자 몫으로 남긴다 |
