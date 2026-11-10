---
created: 2026-11-10
updated: 2026-11-10
status: done
type: plan
feature: fretboard
---

# 지판 외우기 구현 계획

[[fretboard]] 1단계를 구현한다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/domain/fretboard/fretboard.ts` | 표준 튜닝 개방현 음, 위치의 음(반음 0~11), 음 이름 12개, 프렛 범위 정규화, 여유 칸을 더한 그리는 범위 |
| `src/domain/fretboard/questions.ts` | 방식별 후보 문제, 직전 문제를 뺀 가중 무작위 출제(무작위 함수 주입), 정답 판정, 음 보고 위치 찍기의 정답 위치 목록 |
| `src/domain/fretboard/session-result.ts` | 답 기록에서 정답 수, 정답만의 평균 응답 시간, 틀린 문제 목록 |
| `src/presentation/fretboard-settings.ts` | 설정(방식, 줄, 프렛 시작·끝, 문제 수) 저장·읽기. 별도 키, 범위 밖 값은 기본값 |
| `src/presentation/components/Fretboard.tsx` | 컨테이너 폭을 재서 픽셀 단위 SVG 로 그리는 가로 지판. 줄 간격 고정, 칸 폭은 폭 ÷ 칸 수. 칸 전체를 터치 영역으로 쓰고 `pointerdown` 으로 받는다 |
| `src/presentation/pages/FretboardApp.tsx` | 설정, 문제, 결과 세 화면. 답한 뒤 0.5초·1.5초 뒤 다음 문제 |
| `src/presentation/components/AreaSwitch.tsx` | 첫 화면 위쪽 "리듬 / 지판" 전환 |
| `src/App.tsx` | 고른 영역을 저장하고 `PracticeApp` 과 `FretboardApp` 중 하나를 그린다 |

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | 도메인 세 모듈과 단위 테스트(위치의 음, 그리는 범위, 범위 밖 출제 없음, 연속 같은 문제 없음, 두 곳 정답, 결과 요약) | `pnpm build && pnpm test && pnpm lint` |
| 2 | 설정 저장과 지판 컴포넌트 | 같은 명령 |
| 3 | 지판 화면, 영역 전환, App 연결 | 같은 명령, 브라우저에서 완료 기준 확인 |
