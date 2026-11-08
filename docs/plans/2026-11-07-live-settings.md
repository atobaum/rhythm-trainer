---
created: 2026-11-07
updated: 2026-11-07
status: done
type: plan
feature: practice-screen
---

# 연습 중 설정 바꾸기 구현 계획

[[practice-screen#연습 중 설정 바꾸기]]를 구현한다. 바꾼 값은 지금 단위가 끝날 때 세션을 새로 시작해 적용한다. 새 세션은 새 BPM 으로 카운트인 1마디를 하고 같은 위치부터 이어서 친다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/application/loop-plan.ts` | 이어서 치는 세션은 듣고 따라 치기여도 미리 듣기 대신 카운트인 1마디로 시작하는 옵션 |
| `src/presentation/components/LiveControls.tsx` | BPM −5·+5, 기준음 선택, 적용 예정 값 표시 |
| `src/presentation/pages/StageFlowScreen.tsx` | 이어 받을 마디 흐름 상태와 마디별 최근 지표를 받아 그 위치부터 시작. 바꾼 값이 있으면 요청 당시 치던 칸의 판정 시각에 다시 시작을 요청. 흐름이 끝나면 결과에 바꾼 값을 담는다 |
| `src/presentation/pages/SessionScreen.tsx` | 앞 세션의 반복별 깔끔 여부와 친 반복 수를 받아 통과 판단과 친 반복 수에 합친다. 바꾼 값이 있으면 요청 당시 반복이 끝날 때 다시 시작을 요청 |
| `src/presentation/pages/PracticeApp.tsx` | 다시 시작 요청을 받아 설정을 저장하고 새 계획으로 세션을 시작. 손으로 BPM 을 바꾼 연습은 끝날 때 자동 템포를 적용하지 않는다 |

- 다시 시작하면 오디오 엔진이 앞 세션 소리를 모두 끊으므로 미리 예약된 다음 칸 소리는 나지 않는다.
- 판정은 세션마다 따로 계산한다. 앞 세션의 결과는 흐름 상태와 깔끔 여부로만 넘긴다.

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | 미리 듣기 건너뛰는 계획 옵션 | 단위 테스트 |
| 2 | 조작부, 두 화면의 이어 받기와 다시 시작 요청, PracticeApp 연결, 자동 템포 제외 | `pnpm build && pnpm test && pnpm lint`, 브라우저에서 단계 흐름·패턴 반복 중 BPM·기준음 변경 |
