# Handoff

세션 인수인계 문서다. 세션이 끝날 때 `/handoff` 로 갱신하고, 다음 세션은 이 문서부터 읽는다. 커밋한다. 절 구성은 `/handoff` 스킬이 쓰는 것과 같다.

## Goal

악보를 보고, 리듬을 듣고, 화면을 탭해 재현하면서 리듬을 훈련하는 모바일 우선 웹앱. 계획한 기능 10개는 모두 구현했다. 남은 것은 실기기에서만 확인할 수 있는 항목과 사용자가 써 보고 주는 피드백 반영이다.

## Current State

- 이 레포는 `main` 한 커밋으로 시작했다. 앞으로 작업은 `feat/<작업>` 브랜치와 PR 로 한다(`CLAUDE.md` git 절).
- 기능 상태(`docs/design.md` 6절)
  - done. 리듬 엔진, 커리큘럼·자유 연습, 빠른 연습, 리듬 청음, 기타 스트로크, 폴리리듬
  - implementing. 타이밍 판정, 읽기·모방, 연습 화면, 양손. 남은 완료 기준이 전부 실기기 확인이다.
- 마지막으로 바꾼 것(모두 `docs/features/curriculum.md`, `docs/decisions.md` 2026-11-07 행에 있음)
  - 단계는 시작할 때마다 마디를 새로 만들고(음형 1부는 도입 2마디 + 생성 8마디, 나머지는 8마디) 두 마디씩 끊지 않고 친다. 지금 두 마디 아래에 다음 두 마디를 흐리게 보여 준다.
  - 통과 규칙. 첫 시도에 깔끔하면 바로 다음, 한 번이라도 틀렸으면 2번 연속 깔끔해야 다음. 단계 흐름과 자유·빠른 연습의 패턴 반복 모두 같다.
  - 듣고 따라 치기는 두 마디를 처음 칠 때만 들려준다.
  - 빠른 연습 문제는 모두 두 마디.
  - 3연음 섹션을 16분음표 섹션 앞으로 옮겼다. 복습 단계 id 는 `review-섹션키-부`.
- 실기기에서만 확인할 수 있어 남은 항목
  - iPhone·Android 탭 지연과 지터 측정, 그 결과로 웹 유지 여부 결정(`timing-judgement` 7절)
  - 백그라운드 전환 시 중단(`reading-imitation` 5번). Chrome 에서 화면 가림 이벤트로는 확인함
  - 탭 영역 연타·스와이프에서 스크롤·확대 없음(`practice-screen` 7번)
  - 양손 멀티터치(`two-hand` 2번)
- 테스트 136개, `pnpm build && pnpm test && pnpm lint` 통과.

## What Was Tried

### What Worked

- 오디오 시계 변환 기준점을 카운트인 중앙값으로 고정하면 판정이 쏠리지 않는다.
- 단계 흐름의 마디 결과는 탭, 시각, 건너뛰기만으로 정해지므로 상태로 저장하지 않고 렌더마다 처음 칸부터 다시 계산한다(`StageFlowScreen.tsx` 의 `deriveFlow`). effect 안에서 setState 하지 않아도 되고 lint 도 통과한다.
- 실패는 틀린 순간, 성공은 칸 경계(다음 칸 첫 박 120ms 전)에 정해진다. 다음 칸 소리는 결과가 정해질 때 예약한다. Chrome 에서 잰 여유는 가장 늦을 때 약 90ms.
- 브라우저 확인 방법
  - 시작 버튼을 누르고, 상태 문구가 카운트인 "1" 로 바뀐 시점 + 한 박을 첫 칸 시작으로 잡는다.
  - React fiber 에서 `StageFlowScreen` 의 `units` prop(두 마디 단위 패턴 목록)을 읽어 음표 시각에 `keydown` 을 보낸다. 한 영역 입력은 아무 키나, 스트로크·양손은 F·J.
  - 휴대폰 폭은 창 크기 조절이 안 먹어서 페이지에 390×844 iframe 을 띄워 본다.
- 여러 줄 악보는 트랙별 Voice 를 한 Formatter 로 함께 포맷해야 세로가 맞는다. Tuplet 은 Voice 에 넣기 전에 만들어야 박 위치가 맞는다.
- 2박 음형은 4/4 에서 1박이나 3박에서만 시작하게 하고, 앞 마디와 같은 마디가 나오면 새 음형을 하나 덜 넣는다. 안 그러면 4부에서 같은 마디만 반복된다.

### What Didn't Work

- 결과 화면 정리에서 `audioEngine.stop()` 을 부르면 새로 시작한 연습 소리까지 끊긴다. 자기가 시작한 재생만 끄게 고쳤다.
- 콘솔에서 `import('/src/infrastructure/audio/audio-engine.ts')` 로 가져온 `audioEngine` 은 앱과 다른 인스턴스라 세션 시작 시각을 읽을 수 없다. 그래서 상태 문구로 시점을 잡는다.
- 브라우저 탭이 백그라운드면 rAF 가 멈춰 화면이 카운트인에 멈춘 것처럼 보인다. 확인은 한 번의 스크립트 실행 안에서 끝까지 기다리게 한다.
- sandbox 안에서는 pnpm 이 홈 store 에 lock 을 못 만든다. 레포 밖 경로 쓰기도 막힌다.
- 연습 중 파일을 고치면 HMR 로 연습 화면이 다시 마운트돼 탭 기록이 사라진다. 고치고 나서 새로 시작한다.

## Files Changed

- 단계와 생성 `src/domain/curriculum/stages.ts`(`stageBars`, `stageUnits`), `src/domain/rhythm/generator.ts`, `src/domain/rhythm/figures.ts`
- 흐름 규칙 `src/domain/practice/bar-flow.ts`, 통과 규칙 `src/domain/practice/loop-progress.ts`
- 칸 계획·판정 `src/application/bar-flow-plan.ts`, `src/application/bar-flow-evaluation.ts`
- 화면 `src/presentation/pages/StageFlowScreen.tsx`, `PracticeApp.tsx`, `SessionScreen.tsx`
- 빠른 연습 `src/domain/curriculum/quick-curation.ts`

## Next Steps

1. 사용자가 휴대폰에서 써 보고 피드백(`pnpm dev --host` 로 띄우고 같은 Wi-Fi 에서 접속). 실기기 항목 결과를 기능 문서 완료 기준 표에 적는다.
2. 측정 결과로 웹 유지 여부를 `docs/decisions.md` 에 기록
3. 써 보며 정할 가설 값 조정(아래 Context 참고)

## Context & Notes

- 영감을 받은 다른 앱·서비스 이름이나 화면 같은 출처 정보는 문서와 커밋 메시지에 쓰지 않는다(`CLAUDE.md`).
- 화면에 보이는 앱 이름과 localStorage 키(`rhythm-lab.*`)는 그대로 두었다. 키를 바꾸면 기존 기록이 사라진다.
- 번들 약 1MB(Bravura 폰트). TODOS 에 지연 로딩 항목.
- 가설 값. 빠른 연습 문제 구성 비율, 실력 점수, 별점 기준, 단계 생성 마디 수(8), 자동 템포 기준(단위당 평균 시도 1.3번 이하 올림, 3번 초과 내림).
