---
created: 2026-11-07
updated: 2026-11-07
status: implementing
type: plan
feature: practice-screen
---

# 휴대폰 폭 악보 줄 나누기 구현 계획

[[practice-screen#7.4 4단계 휴대폰 폭 악보 배치]]를 구현한다.

## 코드 수준 설계

| 모듈 | 책임 |
|---|---|
| `src/domain/rhythm/pattern.ts` | 여러 마디 패턴을 한 마디짜리 패턴 목록으로 나누는 함수. 마디선을 넘는 이벤트가 있으면 나누지 않는다 |
| `src/presentation/hooks/use-narrow-screen.ts` | 600px 이하 여부 |
| `src/presentation/components/ScoreRows.tsx` | 줄 목록을 그린다. 줄마다 악보, 그 줄의 음표 위치 변환, 커서, 그 줄에 속하는 위치인지 판단을 갖고, 타이밍 트랙은 화면이 넘겨준 함수로 그린다 |
| `src/presentation/pages/StageFlowScreen.tsx`, `SessionScreen.tsx` | 악보와 타이밍 트랙을 `ScoreRows` 로 바꾸고, 표시할 항목을 줄별로 나눈다. 단계 흐름 미리 보기는 휴대폰 폭에서 첫 마디만 작게 |
| `src/presentation/app.css` | 머리글 줄바꿈, 작은 미리 보기 |

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | 마디 나누기 함수 | 단위 테스트(두 마디 나누기, 3연음 그룹 유지, 마디선 넘는 이벤트는 나누지 않음) |
| 2 | 줄 컴포넌트, 두 화면 연결, 미리 보기, 머리글 | `pnpm build && pnpm test && pnpm lint`, 휴대폰에서 완료 기준 확인 |
