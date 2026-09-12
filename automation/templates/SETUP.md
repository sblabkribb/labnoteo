# 연구노트 자동화 설정 가이드 (관리자/개발자용)

> **이 문서는 저장소를 처음 설정하는 관리자·개발자용입니다.**
> 실험하는 연구원의 일상 사용법은 **`QUICKSTART.md`** 를 보세요.

이 문서와 함께 설치된 파일들은 labnoteo 플러그인의 **"Setup research automation"**
명령이 현재 보관함(vault)에 프로비저닝한 것입니다.

## 최초 설정 체크리스트 (한 번만)

순서대로 진행하세요.

- [ ] **① 비공개(PRIVATE) GitHub 저장소 확인** — 연구 정보 보호의 전제입니다.
      공개 저장소는 fork PR을 통한 워크플로우 악용 위험도 있습니다.
- [ ] **② GitHub로 push** — 보관함이 GitHub 저장소여야 Actions(검증/이슈/Wiki)가 동작합니다.
- [ ] **③ pre-commit 훅 활성화** — 보관함 루트에서 한 번 실행:

  ```sh
  git config core.hooksPath .labnoteo/hooks
  ```

  macOS/Linux에서는 실행 권한도 한 번 부여하세요(Windows는 불필요):

  ```sh
  chmod +x .labnoteo/hooks/pre-commit
  ```

- [ ] **④ (Wiki 사용 시) Wiki 초기화 + 토큰** — GitHub Wiki는 별도 저장소입니다.
      저장소 Wiki 탭에서 첫 페이지를 한 번 만들어 초기화하고, 기본 `GITHUB_TOKEN`으로
      Wiki push가 안 되는 구성이라면 Wiki push 권한이 있는 PAT를 시크릿
      `GH_WIKI_TOKEN`에 설정하세요(관리자가 직접 생성).
- [ ] **⑤ (선택·고급) 기존 Git 이력 대용량 감사** — pre-commit 훅은 **이미 커밋된**
      대용량 파일은 막지 못합니다. 오래된 보관함이라면 확인하세요:

  ```sh
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | awk '/^blob/ {print $3, $4}' | sort -nr | head -20
  ```

  큰 파일이 이미 있으면 history rewrite(`git filter-repo` 등) 또는 저장소 이전 여부를
  사람이 판단합니다.

**참고 사항**

- **`.obsidian` ignore 정책**: 전체 제외 금지. 개인 상태(`workspace.json`,
  `workspace-mobile.json`)만 제외하고 공유 설정은 버전관리합니다. (설치된 `.gitignore` 참고)
- 로컬 대용량 파일 훅은 **로컬 Node**를 전제로 합니다. Node가 없으면
  `.labnoteo/hooks/pre-commit`이 순수 shell 크기 검사로 대체됩니다(서버측 검증이 최종 게이트).

## 폴더 구조

연구원이 Obsidian에서 보지 않아도 되는 기계장치는 전부 숨김 폴더 `.labnoteo/`에 모여
있습니다. 점(`.`)으로 시작하는 폴더는 Obsidian 파일 탐색기·검색·그래프에 나타나지 않습니다.

```
vault/
├── .labnoteo/            기계장치 (Obsidian에서 숨김)
│   ├── scripts/          check-large-files.mjs, validate.mjs, issue-sync.mjs
│   ├── hooks/            pre-commit
│   └── SETUP.md          이 문서
├── .github/              워크플로 + 이슈 템플릿
├── .gitignore
├── AGENTS.md             AI 에이전트 규칙
├── CLAUDE.md             @AGENTS.md 포인터
├── QUICKSTART.md         연구원 가이드
├── wiki-staging/         원고 초안 (사람이 편집)
└── labnote/              실험 노트
```

루트에 남는 것에는 각각 이유가 있습니다. `.github/`는 GitHub이 강제하는 경로이고,
`AGENTS.md`/`CLAUDE.md`는 AI 에이전트가 저장소 루트에서만 찾습니다. `QUICKSTART.md`와
`wiki-staging/`은 사람이 Obsidian에서 직접 열어 읽고 편집하는 대상입니다.

## 설치되는 자산 (레퍼런스)

### 대용량 파일 보호

| 경로 | 설명 |
| --- | --- |
| `.labnoteo/scripts/check-large-files.mjs` | 파일 크기 검사(<10MB 허용 / 10–50MB 경고 / >50MB 차단, 자동 이동 없음) |
| `.labnoteo/hooks/pre-commit` | 커밋 전 대용량 파일 차단 훅 (Node 없으면 shell 대체) |
| `.gitignore` | 대용량 데이터 패턴 + Obsidian 개인 상태 + AI 에이전트 상태 폴더(**스킬은 제외 예외로 커밋됨**) (기존 내용에 누락분만 추가) |

### 노트 검증 (GitHub-hosted)

| 경로 | 설명 |
| --- | --- |
| `.labnoteo/scripts/validate.mjs` | status 허용값 / 중복 id / 대용량 파일 중앙 재검사 (결정적) |
| `.github/workflows/validate.yml` | `labnote/**` push마다 `node .labnoteo/scripts/validate.mjs` 실행 |

### Experiment ↔ Issue (결정적, AI 불필요)

| 경로 | 설명 |
| --- | --- |
| `.labnoteo/scripts/issue-sync.mjs` | `discuss: true` 또는 `status: needs-review` 실험만 Issue 생성/갱신(멱등) |
| `.github/workflows/experiment-issues.yml` | 결정적 잡(ubuntu, GitHub-hosted)만 — self-hosted 러너 불필요 |
| `.github/ISSUE_TEMPLATE/experiment.md` | 노트 링크 + Objective + status + Discussion |

### AI 에이전트 규칙 (로컬 에이전트 워크플로우)

| 경로 | 설명 |
| --- | --- |
| `AGENTS.md` | AI 에이전트 규칙 (git/커밋 메시지, 연구노트 규칙, 이슈 신호·Wiki 초안 playbook, 스킬 규칙). 마커 블록만 갱신되므로 사용자 규칙은 마커 밖에 작성 |
| `CLAUDE.md` | Claude Code용 `@AGENTS.md` 1줄 import (내용 중복 없음, AGENTS.md가 단일 소스) |

### Living Manuscript Wiki (사실 연결형)

| 경로 | 설명 |
| --- | --- |
| `.github/workflows/wiki-sync.yml` | 승인된 `wiki-staging/` → GitHub Wiki 동기화 (체크리스트 ④의 토큰 참고) |
| `wiki-staging/*.md` | 논문형 골격(Home/Abstract/…/Results(Finding)/Evidence Index/References) |

### 사용자 문서

| 경로 | 설명 |
| --- | --- |
| `QUICKSTART.md` | 연구원용 일상 사용 가이드(5분 따라하기 + 치트시트 + FAQ) |
| `.labnoteo/SETUP.md` | 이 문서 — 관리자/개발자용 설정 가이드 |

## 아키텍처: AI 워크플로우 (로컬 에이전트 — self-hosted 러너 불필요)

AI가 필요한 판단은 GitHub Actions가 아니라 **로컬 AI 에이전트**(Claude Code, Cursor 등)가
`AGENTS.md` 규칙에 따라 수행합니다. 서버측 자동화는 전부 결정적이라 GitHub-hosted 러너만으로
동작합니다.

- **커밋/푸시**: 에이전트가 네이티브 `git`으로 수행하며, 변경 내용 기반 커밋 메시지를
  작성합니다(Conventional Commits + `EXP-###`). Obsidian Git 플러그인은 필요 없습니다.
  `git commit --no-verify`는 금지입니다(대용량 훅 우회 방지).
- **토론 이슈**: 노트의 자유 서술에서 논의가 필요하다고 판단되면 에이전트가 (사용자 확인 후)
  frontmatter에 `discuss: true`를 설정합니다. push 후 서버 `issue-sync`가 이슈를 멱등
  생성/갱신하므로 에이전트가 이슈를 직접 만들지 않습니다(중복 방지).
  에이전트를 쓰지 않는 연구원은 플러그인의 *Toggle discussion flag* 명령으로 같은
  표시를 켭니다 — 본문 문구만으로는 이슈가 열리지 않습니다(자유 서술 스캔 없음).
- **Wiki 초안**: 에이전트가 노트의 객관적 사실만 `wiki-staging/` 관련 섹션에
  근거 ID(`EXP-###`)와 함께 추가합니다(해석/의견 금지). 사람이 검토·머지하면
  `wiki-sync.yml`이 GitHub Wiki로 발행합니다.
- **Claude Code 사용자**: `CLAUDE.md`의 `@AGENTS.md` import로 위 규칙이 자동 로드됩니다.
  터미널이든 Copilot 에이전트 모드든 같은 `claude` CLI라면 동일하게 적용됩니다.
- **에이전트 상태 폴더**(`.claude/`, `.copilot/`, `.opencode/`, `.agents/`)는 설치된
  `.gitignore`가 커밋에서 제외합니다. 다만 **스킬은 예외로 커밋됩니다** — 정본은
  `.agents/skills/`(Codex·Cursor가 읽음)이고, Claude Code용으로는 `.claude/skills/`에
  얇은 포인터를 둡니다. 스킬은 `AGENTS.md`의 "자동화와의 경계"를 무효화할 수 없습니다.

연구원 관점의 사용 절차(실험 생성 → 논의 표시 → 커밋 → 이슈 확인 → Wiki)는
`QUICKSTART.md`에 있습니다.

## 수동 점검 명령

```sh
node .labnoteo/scripts/check-large-files.mjs   # 대용량 파일 검사
node .labnoteo/scripts/validate.mjs            # 노트 검증 (status/중복 id)
```

## 업데이트

플러그인을 업데이트한 뒤 "Setup research automation" 명령을 다시 실행하면 스크립트와
문서가 갱신됩니다. 변경 사항은 Git diff로 검토한 뒤 커밋하세요. (`AGENTS.md`는 마커
블록만, `.gitignore`/`CLAUDE.md`는 누락 줄만 갱신되므로 사용자 수정이 보존됩니다.)

### 0.82.0 이전 보관함에서 올라올 때 (한 번만)

자산이 루트(`scripts/`, `.githooks/`, `SETUP.md`)에서 `.labnoteo/`로 옮겨졌습니다.
명령을 다시 실행하면 옛 파일을 **확인 후 삭제**해 주지만, 다음 두 가지는 직접 해야 합니다.

- [ ] **훅 경로 재설정** — 옛 `.githooks/pre-commit`이 삭제되면 Git이 훅 없는 폴더를
      가리켜 **대용량 보호가 조용히 꺼집니다.** 반드시 다시 실행하세요:

  ```sh
  git config core.hooksPath .labnoteo/hooks
  ```

- [ ] **`.gitignore`의 낡은 두 줄 삭제** — `.gitignore`는 누락 줄만 *추가*하므로 옛
      `.claude/` / `.agents/` 줄이 그대로 남습니다. 폴더를 통째로 제외하면 Git이 내부로
      내려가지 않아 새로 추가된 `!.claude/skills/` 예외가 무효가 되고, **에이전트 스킬이
      커밋되지 않습니다.** 아래 두 줄을 직접 지우세요(설정 명령이 감지되면 경고합니다).

  ```
  .claude/
  .agents/
  ```
