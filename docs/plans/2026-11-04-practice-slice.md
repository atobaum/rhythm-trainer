---
created: 2026-11-04
updated: 2026-11-04
status: done
type: plan
feature: timing-judgement, reading-imitation, practice-screen
---

# 연습 가능한 첫 슬라이스 구현 계획

사용자가 직접 연습할 수 있는 상태를 만든다. 흐름은 패턴 선택 → (모방이면 미리 듣기) → 카운트인 → 기준음을 들으며 탭 → 탭마다 타이밍 트랙에 점과 오차 → 결과 → 다시 하기다. 대상은 [[timing-judgement]] 1단계, [[reading-imitation]] 1·2단계, [[practice-screen]] 1·2단계이고, 악보는 타임라인 막대로 대신한다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/domain/evaluation/matcher.ts` | 트랙별 DP 시퀀스 정렬로 목표와 탭을 일대일 매칭. 판정 등급 분류 |
| `src/domain/evaluation/metrics.ts` | Hit Rate, MAE, 평균 부호 오차, Miss, Extra |
| `src/domain/practice/auto-tempo.ts` | 최근 결과로 다음 BPM 결정(3연속 성공 +5, 2연속 실패 −5) |
| `src/application/practice-timeline.ts` | 문제 설정 → 소리 일정(미리 듣기, 카운트인, 기준음)과 구간 경계(초). 순수 함수 |
| `src/infrastructure/audio/audio-engine.ts` | AudioContext, 클릭 합성, 오디오 시각 ↔ `performance.now()` 변환 |
| `src/presentation/` | 설정 화면, 연습 화면(타임라인, 타이밍 트랙, 탭 영역), 결과 화면 |

- 탭 시각은 `PointerEvent.timeStamp`. 키보드(스페이스 등)도 탭으로 받는다(데스크톱 확인용).
- 목표 시각(성능 시계) = 오디오 예약 시각을 `getOutputTimestamp()` 로 변환한 값 + 사용자 지연 보정.
- 성공 기준(자동 템포용) = Hit Rate 90% 이상, MAE 60ms 이하, Extra 0. 가설이고 설정값으로 둔다.

## Tasks

| # | 내용 |
|---|---|
| 1 | 매칭·판정·지표 (TDD) |
| 2 | 자동 템포 (TDD) |
| 3 | 연습 일정 계산 (TDD) |
| 4 | 오디오 엔진 |
| 5 | 설정·연습·결과 화면, 샘플 패턴 추가, 미리보기 페이지 제거 |
| 6 | 브라우저에서 실제로 탭해 보며 확인, 완료 기준 결과 기록 |
