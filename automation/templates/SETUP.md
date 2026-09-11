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
| `.github/workflows/experiment-issues.yml` | 결정적 잡(ubuntu) + AI 게이트 잡(self-hosted) |
| `.github/ISSUE_TEMPLATE/experiment.md` | 노트 링크 + Objective + status + Discussion |

### Phase 4b — AI 맥락 게이트 (self-hosted 러너 + 로컬 LLM)

| 경로 | 설명 |
| --- | --- |
| `scripts/issue-gate.mjs` | 키워드 프리필터 → 로컬 LLM 단발 분류(JSON) → 4a와 동일 생성 경로 |
| `ai/prompts/issue-gate.md` | 게이트 프롬프트 (버전관리 단일 소스) |
| `ai/schemas/issue-gate.schema.json` | 게이트 응답 JSON 스키마 |

### Phase 5 — Living Manuscript Wiki (사실 연결형)

| 경로 | 설명 |
| --- | --- |
| `scripts/wiki-propose.mjs` | 객관적 사실 추출 → 섹션 매핑 → 로컬 LLM 병합 → `wiki-staging/`에 제안만 |
| `.github/workflows/wiki-sync.yml` | 승인된 `wiki-staging/` → GitHub Wiki 동기화 (토큰 필요, 아래 주의) |
| `ai/prompts/wiki-propose.md`, `ai/schemas/wiki-propose.schema.json` | Wiki 제안 프롬프트/스키마 |
| `wiki-staging/*.md` | 논문형 골격(Home/Abstract/…/Results(Finding)/Evidence Index/References) |

> **Phase 4b/5 전제**: self-hosted 러너 + 로컬 LLM 엔드포인트가 필요하며, repo variables
> `LLM_ENDPOINT`·`LLM_MODEL`을 설정해야 합니다. self-hosted 러너는 **private repo**에서만
> 안전합니다(공개 repo는 fork PR 실행 위험). AI 잡은 `main` push에서만 동작합니다.
>
> **Wiki 동기화 인증 주의**: GitHub Wiki는 별도 저장소라 기본 `GITHUB_TOKEN`으로 push가
> 안 되는 구성이 많습니다. 그 경우 Wiki push 권한이 있는 PAT를 시크릿 `GH_WIKI_TOKEN`에
> 설정하세요(저장소 관리자가 직접 생성).

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
