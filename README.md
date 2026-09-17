# Labnote Assistant for Obsidian (labnoteo)

**버전 0.87.0**

[English](README.en.md)

생물학·생명정보학 실험을 위한 Obsidian용 Markdown 기반 실험 노트입니다. 샘플 추적, 워크플로 체크리스트, 유닛 오퍼레이션, 선택적 LLM 보조 기능을 제공합니다.

이 저장소는 Labnote Assistant의 Obsidian 포팅 버전입니다. 파싱·도메인 로직은 동반 VS Code 확장과 개념을 공유하지만, 이 저장소 안에서 완전히 자립적으로 동작합니다.

## 주요 기능

- **샘플 추적**: 전용 Samples 사이드바 뷰. 샘플(DNA, RNA, Plasmid 및 사용자 정의 타입)을 정의·삽입·편집·검색합니다. 로컬(노트)/글로벌 범위 간 이동을 지원합니다.
- **워크플로 체크리스트**: Workflows 사이드바 뷰에서 번호가 매겨진 워크플로 노트를 생성·관리하고, 유닛 오퍼레이션을 삽입하며 목차를 자동 동기화합니다.
- **유닛 오퍼레이션**: 내장 카탈로그에서 하드웨어/소프트웨어 유닛 오퍼레이션을 삽입하고, 헤딩 정규화와 목차를 자동 갱신합니다.
- **CSV 내보내기**: 노트의 표를 CSV로 내보냅니다.
- **샘플 자동완성·하이라이트**: 편집 중 샘플 참조에 대한 인라인 제안과 하이라이트를 제공합니다.
- **LLM 보조(선택)**: Ollama 또는 OpenAI로 실험 방법 초안 작성, 결과 요약, 샘플 추출을 수행합니다. *어시스턴트에게 요청* 명령은 한 걸음 더 나아가, 모델이 Labnote의 툴을 직접 호출해 목표를 달성하며 보관함을 수정하기 전에 매번 사용자에게 확인합니다. 같은 툴을 외부 MCP 클라이언트에도 노출할 수 있습니다.
- **실험 상태**: 각 실험의 생애주기(`planned` → `in-progress` → `needs-review` → `completed` / `failed` / …)를 *실험 상태 변경* 명령으로 노트 frontmatter에 기록하고, 검증·Issue 자동화의 기준으로 사용합니다.
- **논의 표시**: *논의 표시 전환* 명령으로 팀 논의가 필요한 노트를 표시합니다. 생애주기 상태와는 독립적이라 `in-progress`인 실험도 상태를 바꾸지 않고 논의를 올릴 수 있으며, 다음 push 때 GitHub Issue가 열립니다.
- **논의 이슈 마커**: 질문은 기록하는 도중에 떠오르므로, 그 자리에 `@issue;<ID>;<주제문장>` 마커를 답니다(이미 쓰고 있는 `@dna;…` 샘플 문법의 확장입니다). 마커마다 별도 Issue가 열리고, 이슈 본문에는 그 줄로 가는 링크가 들어갑니다.
- **연구노트 자동화(선택)**: 명령 한 번으로 GitHub Actions·무의존성(zero-dependency) 스크립트·AI 에이전트 규칙(`AGENTS.md`)을 보관함에 설치해, 노트 검증·Experiment ↔ Issue 연결·Living-Manuscript Wiki 초안을 자동화합니다. 모두 선택적이며 사람이 검토합니다. [연구노트 자동화](#연구노트-자동화) 참고.

## 요구 사항

- Obsidian `1.5.0` 이상.
- 개발 시 Node.js `22+`.

## 설치

### 설치할 플러그인

| 플러그인 | 구분 | 설치 방법 |
| --- | --- | --- |
| **Labnote Assistant** (이 플러그인) | 필수 | BRAT 또는 수동 — 아래 참고 |
| **Copilot** (제작자 logancyang) | 필수 | 설정 → 커뮤니티 플러그인 → **탐색(Browse)** |
| **Obsidian42 - BRAT** | BRAT로 설치할 때만 | 설정 → 커뮤니티 플러그인 → **탐색(Browse)** |
| **Data Files Editor** | 선택 | 설정 → 커뮤니티 플러그인 → **탐색(Browse)** |

- **Copilot**: 에이전트 모드로 로컬 Claude Code CLI를 구동해 git 커밋·이슈 신호·Wiki 초안을 담당합니다. 설정은 [Copilot + Claude Code](#copilot--claude-code) 참고.
- **Data Files Editor**: 샘플 정의가 저장되는 `resources/labsamples/*.json`을 Obsidian 안에서 직접 편집할 때 씁니다.

### Labnote Assistant 설치

아직 커뮤니티 플러그인 목록에 없으므로 릴리스에서 설치합니다. Obsidian은 플러그인을 **보관함(vault) 단위**로 관리하므로(`.obsidian/plugins/`가 보관함 안에 있음) 보관함마다 한 번씩 수행합니다.

**BRAT 사용 (권장, 자동 업데이트)**

1. **Obsidian42 - BRAT**를 설치합니다.
2. *BRAT: Add a beta plugin for testing* 명령을 실행하고 `sblabkribb/labnoteo`를 입력합니다.
3. 설정 → 커뮤니티 플러그인에서 **Labnote Assistant**를 활성화합니다.

**수동 설치**

1. 릴리스에서 `main.js`, `manifest.json`, `styles.css`를 내려받습니다.
2. 보관함에 `.obsidian/plugins/labnoteo/` 폴더를 만들고 세 파일을 복사합니다.
3. 설정 → 커뮤니티 플러그인에서 **Labnote Assistant**를 활성화합니다.

> 릴리스의 `versions.json`은 Obsidian이 **저장소에서** 읽는 파일이라 보관함에 복사할 필요가 없습니다. 보관함이 여러 개라면 각 `.obsidian/plugins/labnoteo`를 하나의 사본으로 심볼릭 링크해 두면 복사를 반복하지 않아도 됩니다.

## 주요 명령어

명령 팔레트에는 영문 이름으로 등록됩니다(괄호 안).

| 명령어 | 설명 |
|---|---|
| 날짜 삽입 (`Insert date`) | 현재 날짜 삽입 |
| 날짜 및 시간 삽입 (`Insert date and time`) | 현재 타임스탬프 삽입 |
| 실험 생성 (`Create experiment`) | 새 `.labnote.md` 실험 노트 생성 |
| 실험 상태 변경 (`Change experiment status`) | 활성 실험의 `status` frontmatter를 피커로 변경 |
| 논의 표시 전환 (`Toggle discussion flag`) | 활성 실험의 `discuss` 표시를 켜고 끔 — 다음 push 때 GitHub Issue 생성 |
| 논의 이슈 마커 삽입 (`Insert issue marker`) | 커서 위치에 `@issue;<ID>;<주제문장>` 마커 삽입(선택 영역이 주제문장) — 마커마다 별도 Issue 생성 |
| 워크플로 생성 (`Create workflow`) | 번호가 매겨진 워크플로 노트 생성 |
| 유닛 오퍼레이션 삽입 (`Insert unit operation`) | 카탈로그에서 유닛 오퍼레이션 삽입 |
| 표 CSV 내보내기 (`Export tables to CSV`) | 노트의 표를 CSV로 내보내기 |
| 연구노트 자동화 설정 (`Setup research automation`) | GitHub Actions·스크립트를 현재 보관함에 설치([연구노트 자동화](#연구노트-자동화) 참고) |
| AI: Method 섹션 초안 (`AI: Draft Method section`) | 설정된 LLM으로 실험 방법 초안 작성 |
| AI: 결과 요약 (`AI: Summarize results`) | 설정된 LLM으로 결과 요약 |
| AI: 샘플 정의 추출 (`AI: Extract sample definitions`) | 설정된 LLM으로 노트에서 샘플 추출 |
| AI: 어시스턴트에게 요청 (`AI: Ask assistant (uses tools)`) | 목표를 말하면 모델이 Labnote 툴로 수행 |
| MCP 서버 토글 (`Toggle MCP server`) | 로컬 MCP 서버 시작/중지 |
| 워크플로/샘플 뷰 열기 (`Open workflow view` / `Open sample view`) | 사이드바 뷰 표시 |

> 파일 탐색기에서 워크플로 파일 이름을 바꾸면 README 체크리스트가 새 번호(NNN) 순서로 자동 재정렬되고, 삭제하면 해당 체크리스트 항목과 그 파일이 정의한 샘플이 자동으로 정리됩니다.

## 연구노트 자동화

노트 자체를 넘어, labnoteo는 보관함을 GitHub 위의 경량 연구노트 시스템으로 바꿔 줍니다 — 노트 검증, Experiment ↔ Issue 연결, Living-Manuscript Wiki를 CI를 직접 작성하지 않고도 구성합니다. 보관함은 사용자마다 다르므로, 플러그인이 설치된 보관함에 이 자산들을 직접 **프로비저닝**합니다.

명령 팔레트에서 **연구노트 자동화 설정**(`Setup research automation`)을 실행하세요. 아래 파일들을 현재 보관함에 기록합니다 — 상위 폴더를 만들고, 덮어쓰기 전에는 확인을 받으며, 기존 `.gitignore`에는 누락된 줄만 *추가*합니다. 이후 연구원의 일상 사용법은 생성된 `QUICKSTART.md`가, 일회성 설정 절차는 `.labnoteo/SETUP.md`(관리자용)가 안내합니다.

기계장치는 숨김 폴더 `.labnoteo/` 하나에 모여 있어서, Obsidian 탐색기에는 연구원이 실제로 여는 것만 남습니다 — `labnote/`, `wiki-staging/`, `QUICKSTART.md`, 에이전트 규칙. 이전 버전에서 올라오는 경우 루트에 흩어져 있던 옛 파일을 확인 후 삭제해 줍니다.

| 영역 | 파일 | 하는 일 |
| --- | --- | --- |
| 사용자 문서 | `QUICKSTART.md`, `.labnoteo/SETUP.md` | 연구원용 가이드(5분 따라하기·치트시트·기능 레퍼런스·FAQ)와 관리자/개발자용 설정 가이드(일회성 체크리스트·자산 레퍼런스·아키텍처). |
| 대용량 파일 보호 | `.labnoteo/scripts/check-large-files.mjs`, `.labnoteo/hooks/pre-commit`, `.gitignore` | 커밋 전에 과도하게 큰 데이터 파일을 차단(Node 없으면 shell로 대체). |
| 검증 | `.labnoteo/scripts/validate.mjs`, `.github/workflows/validate.yml` | push마다 `status` 값, 실험 id 중복, `@issue` 마커 형식과 폴더 내 ID 유일성을 검사. |
| Experiment ↔ Issue | `.labnoteo/scripts/issue-sync.mjs`, `.github/workflows/experiment-issues.yml`, `.github/ISSUE_TEMPLATE/experiment.md` | `discuss: true` 또는 `status: needs-review`인 실험마다 스레드 Issue 1개(닫혀 있으면 재오픈), 바뀐 실험 폴더의 **모든** `*.labnote.md`에서 찾은 `@issue;<ID>;<주제>` 마커마다 그 줄로 링크된 별도 Issue(해결되어 닫힌 것은 유지). 결정적, GitHub REST API. |
| 수동 백필 | `experiment-issues.yml` / `validate.yml`의 `workflow_dispatch` | Actions 탭에서 직접 실행. `issue-sync`는 push diff 대신 모든 실험 폴더를 훑어(`--all`) 자동화 도입 전에 적어 둔 마커까지 채웁니다 — 멱등이며, 닫힌 논의 스레드는 의도적으로 그대로 둡니다. |
| AI 에이전트 규칙 | `AGENTS.md`, `CLAUDE.md` | 로컬 AI 에이전트(Claude Code, Cursor 등)를 위한 규칙: git 워크플로우·커밋 메시지, 언제 노트에 `discuss: true`를 표시할지, `wiki-staging/`에 사실을 어떻게 초안할지. `CLAUDE.md`는 Claude Code용 `@AGENTS.md` 1줄 import. 재실행 시 labnoteo 관리 마커 블록만 갱신되고 그 밖의 사용자 규칙은 보존됩니다. |
| Living-Manuscript Wiki(선택) | `.github/workflows/wiki-sync.yml`, `wiki-staging/*` | 사람이 검토·머지한 `wiki-staging/` 초안을 GitHub Wiki로 발행. |

번들된 스크립트는 **무의존성** Node ESM입니다: labnoteo의 `@labnoteo/core` 함수를 그대로 재사용하므로 플러그인과 드리프트가 없고, `node .labnoteo/scripts/*.mjs`로 실행됩니다 — 보관함에서 `npm install`이 필요 없습니다.

**전제 조건 및 범위**

- 어떤 Actions든 동작하려면 보관함이 GitHub 저장소여야 합니다(먼저 push). 연구 데이터가 있으면 **private**로 유지하세요.
- 서버측 자동화는 전부 **결정적**이라 GitHub-hosted 러너만으로 동작합니다 — self-hosted 러너나 서버측 LLM이 필요 없습니다. AI 판단(이 노트에 논의가 필요한가? 어떤 사실이 Wiki에 들어가야 하는가?)은 **로컬 AI 에이전트**가 `AGENTS.md` 규칙에 따라 수행합니다. 에이전트는 `discuss: true` 신호를 설정하거나 `wiki-staging/`에 초안만 작성하고, 이슈 생성/Wiki 발행은 `issue-sync`/`wiki-sync`가 단독 담당하므로 중복이 없습니다. Wiki는 별도 저장소이므로 `wiki-sync.yml`은 PAT(`GH_WIKI_TOKEN`)가 추가로 필요할 수 있습니다.
- 자동화는 **노트를 절대 되쓰지 않습니다** — Issue를 열고 검토된 Wiki 초안을 발행만 하며, 과학적 판단과 `status` 변경은 사람의 몫입니다.
- 플러그인 업데이트 후에는 명령을 다시 실행해 스크립트를 갱신하고, 커밋 전에 diff를 검토하세요.

따라하기·치트시트는 보관함에 생성된 `QUICKSTART.md`(연구원용)를, 전체 설정 체크리스트는 `.labnoteo/SETUP.md`(관리자용)를 참고하세요.

## 설정

**샘플**

- **샘플 추적**: Samples 사이드바 뷰 표시 여부.
- **사용자 정의 샘플 타입**: 내장 타입 외에 사용자 정의 타입 추가.
- **글로벌 샘플 폴더**: 보관함 전역 샘플 저장소 폴더 (기본 `resources/labsamples`).

**AI 제공자**

- **제공자**: `none`, `ollama`, `openai`. 플러그인이 제공자와 직접 통신합니다.
- **Ollama 엔드포인트** / **OpenAI 엔드포인트**: 기본 URL. 제공자를 바꿀 때 OpenAI 키가 로컬 Ollama 주소로 새어 나가지 않도록 필드를 분리해 두었습니다.
- **모델**: 모델 id. 예: `qwen3`, `gpt-4o-mini`.
- **API 키**: OpenAI 호환 제공자 전용 — Ollama로는 전송되지 않습니다.

> **툴 호출에는 함수 호출(function calling)을 지원하는 모델이 필요합니다.** Ollama에서는 `tools` capability가 있는 모델(`qwen3`, `llama3.1` 등)을 쓰세요. 지원하지 않는 모델은 툴을 호출하지 않고 산문으로만 답합니다.

**MCP 서버** — 아래 절 참고.

## MCP 서버 (데스크톱 전용)

MCP 서버를 켜면 Labnote의 툴(`get_sample`, `list_samples`, `create_sample`, `get_unit_operation`, `update_section`, `create_workflow`)을 Claude Desktop 같은 외부 MCP 클라이언트에 노출합니다.

- **엔드포인트**: `http://127.0.0.1:3987` — 루프백 전용이며 라우팅 가능한 인터페이스에는 바인딩하지 않습니다.
- **인증**: 세션마다 무작위로 생성되는 베어러 토큰. 서버가 실행 중일 때 설정 → **MCP 토큰**에서 복사하세요. 서버를 재시작할 때마다 바뀝니다.
- **쓰기는 확인을 거칩니다**: 보관함을 수정하는 툴은 실행 전에 대상 경로와 함께 확인을 요청합니다. 경로를 고르는 것은 모델이기 때문입니다.

서버는 MCP `2025-06-18` 개정의 **무상태(stateless)** 구현입니다(`initialize`, `tools/list`, `tools/call`). DNS 리바인딩 방어를 위해 `Origin` 헤더를 검증하며, 인증이 OAuth가 아니라 베어러 토큰이므로 클라이언트가 커스텀 `Authorization` 헤더를 설정할 수 있어야 합니다.

## Copilot + Claude Code

Copilot의 **에이전트 모드**는 이 컴퓨터에 설치된 CLI 에이전트(OpenCode / **Claude Code** / Codex)를 그대로 실행합니다. "Claude"를 고르면 로컬 `claude` CLI를 구동하며, 인증은 **API 키가 아니라 CLI에 로그인된 Claude 구독 계정**(Pro/Max/Team/Enterprise)을 사용합니다.

labnoteo 내장 AI 명령과는 다른 층입니다: 내장 AI는 Obsidian *안에서* 초안·요약을 담당하고, 이 외부 에이전트는 git·이슈 신호·Wiki 초안을 담당합니다. [연구노트 자동화](#연구노트-자동화)를 설정했다면 생성된 `AGENTS.md`/`CLAUDE.md`를 같은 `claude` CLI가 터미널에서든 Copilot 에이전트 모드에서든 자동으로 읽습니다.

### 1) Claude Code 설치 & 로그인

1. Copilot 설정 → **Basic → Agents → Claude → Configure**의 *Install Claude Code*에 표시된 설치 명령을 실행합니다. Windows PowerShell 예시:
   ```powershell
   irm https://gist.githubusercontent.com/logancyang/7a87eb38d91015eac567521f8cc9c729/raw/install-claude-agent-mode-windows.ps1 | iex
   ```
2. 브라우저 로그인 창이 뜨면 Claude 계정으로 로그인합니다. **구독(Pro/Max/Team/Enterprise) 계정이면 API 키가 필요 없습니다.**
3. 터미널에서 `claude`를 실행하고 `/status`로 인증 상태를 확인합니다.

> 환경변수 `ANTHROPIC_API_KEY`가 있으면 구독 로그인보다 **우선 적용**되어 그 키로 과금됩니다. 구독으로 쓰려면 비워 두세요.

### 2) Copilot에서 Claude 에이전트 연결

1. 설정 → Copilot → **Basic → Agents → Claude → Configure → Auto-detect**를 누릅니다. 못 찾으면 `claude` 실행 파일 경로를 바이너리 경로 칸에 붙여넣고 저장합니다. ("not in your PATH" 경고는 무시해도 됩니다.)
2. 명령 팔레트에서 **Open Copilot Agent Chat Window**를 실행하고 **Claude**를 선택합니다.
3. 노트에서 텍스트를 선택하면 에이전트 모드의 컨텍스트 컨트롤로 선택 텍스트·활성 노트를 대화에 추가할 수 있습니다.

### 3) (선택) Labnote 툴을 Claude에 연결 — MCP

Claude Code에 labnoteo의 MCP 서버를 등록하면 터미널과 Copilot 에이전트 모드 양쪽에서 같은 `claude` 바이너리가 Labnote 툴을 직접 호출합니다. **데스크톱 전용**입니다.

1. 명령 팔레트에서 **Toggle MCP server**를 실행하고, 설정 → **MCP 토큰**에서 토큰을 복사합니다(서버를 껐다 켤 때마다 새로 발급).
2. 복사한 토큰으로 등록합니다:
   ```bash
   claude mcp add --transport http labnoteo http://127.0.0.1:3987 \
     --header "Authorization: Bearer <복사한-토큰>"
   ```
3. `claude mcp list`로 연결을 확인합니다. 이후 자연어로 지시하면 됩니다 — 예: "list_samples로 이 보관함의 DNA 샘플을 보여줘".

**주의**

- **토큰 갱신**: 서버를 껐다 켜면 토큰이 바뀝니다. `claude mcp remove labnoteo` 후 새 토큰으로 다시 `add`하세요.
- **쓰기 확인**: 보관함을 수정하는 툴은 실행 전에 Obsidian이 대상 경로와 함께 확인창을 띄웁니다.
- **헤더 이슈**: 일부 Claude Code 버전(특히 Windows)이 `Authorization` 헤더를 누락해 `401`이 납니다. 반복되면 최신 버전으로 업데이트하세요.

## 개발자 참고

npm workspaces 모노레포 구조입니다:

- `src/` — Obsidian 플러그인. esbuild로 저장소 루트의 `main.js`로 번들됩니다. Obsidian 커뮤니티 디렉터리가 루트의 `manifest.json`을 읽기 때문에 플러그인이 루트에 있습니다.
- `packages/labnoteo-core` — 플랫폼 중립 core 로직 (파서, 워크플로/샘플 도메인). 플러그인이 사용합니다. Node 전용 API를 import하면 안 되며, 플랫폼 의존 기능은 포트(`LabnoteFs`, `LabnoteHost`) 뒤에 둡니다.
- `automation/` — 보관함에 설치되는 [연구노트 자동화](#연구노트-자동화) 스크립트의 소스. esbuild가 (1단계) 무의존성 `dist-automation/*.mjs`로 번들하고 — 플러그인과 같은 `@labnoteo/core` 소스를 재사용하므로 드리프트가 없음 — (2단계) 워크플로/AGENTS.md/Wiki 템플릿과 함께 `main.js`에 문자열로 임베드합니다. 덕분에 3-파일 설치만으로 자립합니다. *연구노트 자동화 설정* 명령이 그 문자열을 보관함에 기록합니다. 이 폴더의 소스가 전부 배포되는 것은 아닙니다 — `issue-gate.ts`와 `wiki-propose.ts`는 그 판단을 이제 로컬 AI 에이전트가 맡으므로 빌드에서 제외되어 있고(`esbuild.config.mjs`), 향후 opt-in 경로를 위해 소스만 남겨 둡니다.
- `issue-sync`와 `validate`는 **같은 마커를 봐야** 합니다. 그래서 둘 다 README를 직접 읽지 않고 `readMarkerSources`로 폴더를 읽습니다 — 한쪽만 범위를 좁히면 검증되지 않은 마커로 이슈가 열리거나 그 반대가 됩니다.
- `tests/` — 플러그인 계층 테스트와 `obsidian` 패키지의 런타임 스텁(해당 패키지는 타입만 제공). core 테스트는 코드 옆 `packages/labnoteo-core/src/__tests__/`에 있습니다.

```bash
npm install           # 전체 워크스페이스 설치
npm run dev           # 워치 빌드
npm run build         # Obsidian 플러그인 번들 -> main.js
npm run typecheck     # core + plugin 타입 검사
npm test              # 전체 테스트 실행 (vitest: core + plugin 프로젝트)
npm run sync:versions # 루트 버전을 패키지, manifest, README에 전파
```

`npm run sync:versions -- --check`는 아무것도 쓰지 않고, 루트 `package.json` 버전과 어긋난 대상이 있으면 실패합니다. CI가 이 형태로 실행합니다.

모든 `LabnoteFs` 구현은 `packages/labnoteo-core/src/__tests__/labnoteFsContract.ts`의 공용 계약 테스트를 통과해야 합니다. `{Type}.json`의 원자성 보장이 여기서 강제됩니다.

`npm run record:fixtures`는 `tests/fixtures/llm/`의 LLM 응답 픽스처를 실제 제공자로부터 다시 녹화합니다. 픽스처의 목적과 provenance 표기는 해당 폴더의 README를 참고하세요.

## 라이선스

MIT
