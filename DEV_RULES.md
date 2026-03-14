# 개발 규칙 (Development Rules)

이 프로젝트에서 새로운 기능을 개발할 때 반드시 아래 규칙을 따른다.

---

## 브랜치 전략

### 1. 새 기능은 반드시 새 브랜치에서 작업한다

- `main` 브랜치에 직접 커밋하지 않는다.
- 브랜치 이름 규칙:
  - 기능 추가: `feature/기능명` (예: `feature/travel-planner`)
  - 버그 수정: `fix/버그명` (예: `fix/cors-403`)
  - 개선: `improve/항목명` (예: `improve/editor-autosave`)

```bash
git checkout -b feature/기능명
```

### 2. PR(Pull Request)을 올려 코드 리뷰를 받는다

- 기능 구현 완료 후 GitHub에 PR을 생성한다.
- PR 본문에는 다음을 포함한다:
  - 어떤 기능/수정인지 요약
  - 주요 변경 파일 목록
  - 테스트 방법 또는 확인 방법
- 사용자(shinsanha)의 리뷰 및 승인(`OK`)을 기다린다.

```bash
gh pr create --title "기능명" --body "설명"
```

### 3. 승인된 PR만 main에 머지한다

- 사용자가 OK한 PR만 `main` 브랜치에 머지한다.
- 머지 후 해당 브랜치는 삭제한다.

### 4. main 머지 후 반드시 모든 MD 파일을 업데이트한다

- PR이 main에 머지될 때마다 아래 파일을 최신 상태로 갱신한다:
  - `README.md` — 기능 목록, API, 프로젝트 구조 반영
  - `DEPLOY.md` — DB 스키마 변경, 환경변수 변경 반영
  - `CLAUDE.md` — 아키텍처/구조 변경 반영
  - `DEV_RULES.md` — 규칙 변경 시 갱신
- MD 업데이트도 같은 feature 브랜치 커밋에 포함하거나, 머지 직후 main에서 별도 커밋으로 반영한다.

---

## Claude Code에 대한 지시사항

- 세션 시작 시 이 파일을 읽고 위 규칙을 준수한다.
- 새로운 기능 추가 요청이 들어오면:
  1. 현재 브랜치 확인 (`git branch`)
  2. `main`이면 새 브랜치 생성 후 작업
  3. 작업 완료 후 PR 생성
  4. 사용자 승인 대기 — 승인 없이 `main`에 머지하지 않는다.
  5. 머지 확인 후 모든 MD 파일 업데이트 및 배포
- 버그 수정(긴급)은 사용자와 협의 후 결정한다.
