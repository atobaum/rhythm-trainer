---
created: 2026-11-08
updated: 2026-11-08
status: implementing
type: plan
feature: design
---

# GitHub Pages 배포 계획

[[design#7. 스택과 배포 형태]]의 배포를 GitHub Pages 로 한다.

## 설계

| 파일 | 책임 |
|---|---|
| `vite.config.ts` | `base: './'`. 레포 이름 경로(`/rhythm-trainer/`) 아래에서도 자산 경로가 맞게 |
| `.github/workflows/deploy.yml` | main push 와 수동 실행. pnpm 설치, `pnpm build && pnpm test && pnpm lint`, `dist` 를 Pages artifact 로 올리고 배포 |
| 레포 설정 | Pages 소스를 GitHub Actions 로(`gh api -X POST repos/atobaum/rhythm-trainer/pages -f build_type=workflow`) |

- SPA 이지만 주소 경로 라우팅을 쓰지 않아(history 는 같은 주소에 상태만 쌓음) 404 대체 페이지가 필요 없다. 쓰고 있으면 함께 처리한다.
- `public/` 의 절대 경로 참조가 있으면 상대 경로로 바꾼다.

## Tasks

| # | 내용 | 검증 |
|---|---|---|
| 1 | base, workflow, README 에 배포 주소 | `pnpm build` 후 `pnpm preview --base ./` 대신 `dist` 를 하위 경로로 서빙해 로딩 확인 |
| 2 | Pages 활성화 | `gh api repos/atobaum/rhythm-trainer/pages` 가 build_type workflow. 실제 배포는 main 머지 후 |
