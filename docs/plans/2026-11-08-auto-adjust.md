---
created: 2026-11-08
updated: 2026-11-08
status: implementing
type: plan
feature: practice-screen
---

# 연습 중 자동 조절 구현 계획

[[practice-screen#연습 중 자동 조절]]을 구현한다. [[2026-11-07-live-settings]] 의 다시 시작 경로(지금 칸이 끝나면 카운트인 1마디 후 같은 위치부터 이어 치기)를 그대로 쓴다. 자동 조절은 "자동으로 만든 연습 중 설정 변경" 이다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/domain/practice/auto-adjust.ts` | 순수 함수. 칸 결과(깔끔, 실패) 순서와 시작 기준음·지금 템포·지금 기준음·연속 깔끔 수를 받아 다음 상태와 바꿀 값(없으면 null)을 낸다. 기준음 순서 `every-beat → first-beat → gap → none`. 템포 +5, 최대 200. 실패하면 기준음만 한 단계 되돌림(시작 값까지). 조절이 적용되면 연속 수를 0 으로 |
| `src/presentation/practice-settings.ts` | `tempoRamp: boolean`, `guideFade: boolean` 기본 false. 저장 형식은 필드 추가라 기존 저장값과 호환(없으면 기본값) |
| `src/presentation/pages/SetupScreen.tsx` | 옵션 시트에 두 켜기·끄기. 단계 목록일 때만 보이거나, 늘 보이고 "단계에만 적용" 설명 |
| `src/presentation/pages/StageFlowScreen.tsx` | 칸 결과가 정해질 때 자동 조절 상태를 갱신하고, 바꿀 값이 있으면 손으로 바꾼 값과 합쳐 기존 `liveChange` 경로로 다시 시작을 요청. 손으로 바꾼 값이 같은 경계에 있으면 손으로 바꾼 값이 우선. 자동 조절 상태(연속 수)는 다시 시작 때 넘겨 이어 받는다 |
| `src/presentation/pages/PracticeApp.tsx` | 자동 조절로 생긴 변경은 설정에 저장하지 않는다(손으로 바꾼 변경만 저장). 템포 올리기가 적용된 흐름은 끝날 때 자동 템포 미적용 |

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | `auto-adjust.ts` 와 단위 테스트(연속 2칸, 최대 200, 되돌림 한계, 둘 다 켜짐) | `pnpm build && pnpm test && pnpm lint` |
| 2 | 설정 필드, 옵션 시트 | 같은 명령 |
| 3 | StageFlowScreen·PracticeApp 연결, 저장 제외, 자동 템포 제외 | 같은 명령, Chrome 에서 키 입력으로 두 칸 깔끔 → BPM·기준음 변경 확인 |
