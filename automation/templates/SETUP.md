# 연구노트 자동화 설정 (labnoteo)

이 문서와 함께 설치된 파일들은 **labnoteo 플러그인의 "연구노트 자동화 설정" 명령**이
현재 보관함(vault)에 프로비저닝한 것입니다. 아래 순서대로 한 번만 설정하면 됩니다.

## Phase 0 — 현황 점검 (자동화 켜기 전에 먼저)

pre-commit 훅은 **이미 커밋된** 대용량 파일은 막지 못합니다. 먼저 점검하세요.

- [ ] **Git 이력 대용량 파일 감사**: 아래로 이미 들어간 큰 파일을 확인합니다.
  ```sh
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | awk '/^blob/ {print $3, $4}' | sort -nr | head -20
  ```
  큰 파일이 이미 있으면 history rewrite(`git filter-repo` 등) 또는 저장소 이전 여부를 사람이 판단합니다.
- [ ] **비공개(PRIVATE) 저장소 확인**: 연구 정보 보호 + (향후) self-hosted 러너 보안의 전제입니다.
      공개 저장소라면 fork PR이 러너 코드를 실행할 수 있어 위험합니다.
- [ ] **`.obsidian` ignore 정책**: 전체 제외 금지. 개인 상태(`workspace.json`,
      `workspace-mobile.json`)만 제외하고 공유 설정은 버전관리합니다. (설치된 `.gitignore` 참고)

## 사전 조건

- [ ] **GitHub 저장소로 push** 되어 있어야 GitHub Actions(향후 단계)가 동작합니다.
- [ ] 로컬 대용량 파일 훅은 **로컬 Node**를 전제로 합니다. Node가 없으면
      `.githooks/pre-commit`이 순수 shell 크기 검사로 대체됩니다(서버측 검증이 최종 게이트).

## 설치되는 자산

### Phase 2c — 대용량 파일 보호

| 경로 | 설명 |
| --- | --- |
| `scripts/check-large-files.mjs` | 파일 크기 검사(<10MB 허용 / 10–50MB 경고 / >50MB 차단, 자동 이동 없음) |
| `.githooks/pre-commit` | 커밋 전 대용량 파일 차단 훅 (Node 없으면 shell 대체) |
| `.gitignore` | 대용량 데이터 패턴 + Obsidian 개인 상태 (기존 내용에 누락분만 추가) |

### Phase 3 — 검증 (GitHub-hosted)

| 경로 | 설명 |
| --- | --- |
| `scripts/validate.mjs` | status 허용값 / 중복 id / 대용량 파일 중앙 재검사 (결정적) |
| `.github/workflows/validate.yml` | `labnote/**` push마다 `node scripts/validate.mjs` 실행 |

### Phase 4a — Experiment ↔ Issue (결정적, AI 불필요)

| 경로 | 설명 |
| --- | --- |
| `scripts/issue-sync.mjs` | `discuss: true` 또는 `status: needs-review` 실험만 Issue 생성/갱신(멱등) |
| `.github/workflows/experiment-issues.yml` | 결정적 잡(ubuntu, GitHub-hosted)만 — self-hosted 러너 불필요 |
| `.github/ISSUE_TEMPLATE/experiment.md` | 노트 링크 + Objective + status + Discussion |

### AI 에이전트 규칙 (로컬 에이전트 워크플로우)

| 경로 | 설명 |
| --- | --- |
| `AGENTS.md` | AI 에이전트 규칙 (git/커밋 메시지, 연구노트 규칙, 이슈 신호·Wiki 초안 playbook). 마커 블록만 갱신되므로 사용자 규칙은 마커 밖에 작성 |
| `CLAUDE.md` | Claude Code용 `@AGENTS.md` 1줄 import (내용 중복 없음, AGENTS.md가 단일 소스) |

### Phase 5 — Living Manuscript Wiki (사실 연결형)

| 경로 | 설명 |
| --- | --- |
| `.github/workflows/wiki-sync.yml` | 승인된 `wiki-staging/` → GitHub Wiki 동기화 (토큰 필요, 아래 주의) |
| `wiki-staging/*.md` | 논문형 골격(Home/Abstract/…/Results(Finding)/Evidence Index/References) |

> **Wiki 동기화 인증 주의**: GitHub Wiki는 별도 저장소라 기본 `GITHUB_TOKEN`으로 push가
> 안 되는 구성이 많습니다. 그 경우 Wiki push 권한이 있는 PAT를 시크릿 `GH_WIKI_TOKEN`에
> 설정하세요(저장소 관리자가 직접 생성).

## AI 워크플로우 (로컬 에이전트 — self-hosted 러너 불필요)

AI가 필요한 판단은 GitHub Actions가 아니라 **로컬 AI 에이전트**(Claude Code, Cursor 등)가
`AGENTS.md` 규칙에 따라 수행합니다. 서버측 자동화는 전부 결정적이라 GitHub-hosted 러너만으로
동작합니다.

- **커밋/푸시**: 에이전트가 네이티브 `git`으로 수행하며, 변경 내용 기반 커밋 메시지를
  작성합니다(Conventional Commits + `EXP-###`). Obsidian Git 플러그인은 필요 없습니다.
  `git commit --no-verify`는 금지입니다(대용량 훅 우회 방지).
- **토론 이슈**: 노트의 자유 서술에서 논의가 필요하다고 판단되면 에이전트가 (사용자 확인 후)
  frontmatter에 `discuss: true`를 설정합니다. push 후 서버 `issue-sync`가 이슈를 멱등
  생성/갱신하므로 에이전트가 이슈를 직접 만들지 않습니다(중복 방지).
- **Wiki 초안**: 에이전트가 노트의 객관적 사실만 `wiki-staging/` 관련 섹션에
  근거 ID(`EXP-###`)와 함께 추가합니다(해석/의견 금지). 사람이 검토·머지하면
  `wiki-sync.yml`이 GitHub Wiki로 발행합니다.
- **Claude Code 사용자**: `CLAUDE.md`의 `@AGENTS.md` import로 위 규칙이 자동 로드됩니다.
  터미널이든 Copilot 에이전트 모드든 같은 `claude` CLI라면 동일하게 적용됩니다.
- **에이전트 상태 폴더**(`.claude/`, `.copilot/`, `.opencode/`, `.agents/`)는 설치된
  `.gitignore`가 커밋에서 제외합니다.

## 훅 활성화

커밋 전 대용량 파일 검사를 켜려면 보관함 루트에서 한 번 실행하세요.

```sh
git config core.hooksPath .githooks
```

수동 점검이 필요하면 직접 실행할 수도 있습니다.

```sh
node scripts/check-large-files.mjs
```

## 업데이트

플러그인을 업데이트한 뒤 "연구노트 자동화 설정" 명령을 다시 실행하면 스크립트가 갱신됩니다.
변경 사항은 Git diff로 검토한 뒤 커밋하세요.
