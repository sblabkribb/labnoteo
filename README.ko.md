# Labnote Assistant for Obsidian (labnoteo)

**버전 0.80.0**

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
- **연구노트 자동화(선택)**: 명령 한 번으로 GitHub Actions와 무의존성(zero-dependency) 스크립트를 보관함에 설치해, 노트 검증·Experiment ↔ Issue 연결·Living-Manuscript Wiki 초안을 자동화합니다. 모두 선택적이며 사람이 검토합니다. [연구노트 자동화](#연구노트-자동화) 참고.

## 요구 사항

- Obsidian `1.5.0` 이상.
- 개발 시 Node.js `22+`.

## 설치

아직 Obsidian 커뮤니티 플러그인 목록에 등재되지 않았으므로 릴리스에서 설치합니다. Obsidian은 플러그인을 **보관함(vault) 단위**로 관리합니다(`.obsidian/plugins/`가 보관함 안에 있음). 따라서 아래 두 방법 모두 보관함마다 한 번씩 수행해야 합니다.

**BRAT 사용 (권장, 자동 업데이트)**

1. 설정 → 커뮤니티 플러그인에서 **Obsidian42 - BRAT**를 설치합니다.
2. *BRAT: Add a beta plugin for testing* 명령을 실행하고 `sblabkribb/labnoteo`를 입력합니다.
3. 설정 → 커뮤니티 플러그인에서 **Labnote Assistant**를 활성화합니다.

BRAT이 이 저장소의 릴리스를 추적하므로, 이후 버전은 파일을 직접 다루지 않아도 반영됩니다.

**수동 설치**

1. 릴리스에서 `main.js`, `manifest.json`, `styles.css`를 내려받습니다.
2. 보관함의 `.obsidian/plugins/labnoteo/` 폴더를 만들고 세 파일을 복사합니다.
3. 설정 → 커뮤니티 플러그인에서 **Labnote Assistant**를 활성화합니다.

보관함이 여러 개라면 각 `.obsidian/plugins/labnoteo`를 하나의 사본으로 심볼릭 링크하면 복사를 반복하지 않아도 됩니다. 개발 중에는 `npm run dev`의 재빌드 결과가 모든 보관함에 동시에 반영되는 이점도 있습니다.

> 릴리스에는 `versions.json`도 포함됩니다. 이 파일은 Obsidian이 **저장소에서** 읽어 앱 버전별로 업데이트 가능한 플러그인 버전을 판단하는 용도이며, 보관함 안에서는 무시되므로 복사할 필요가 없습니다.

### 함께 쓰면 편한 플러그인 (선택)

아래 두 개는 커뮤니티 플러그인 목록에 등재되어 있어, 설정 → 커뮤니티 플러그인 → **탐색(Browse)**에서 검색해 바로 설치할 수 있습니다.

- **Data Files Editor**: 샘플 정의가 저장되는 `resources/labsamples/*.json` 같은 JSON 파일을 Obsidian 안에서 직접 열어 편집할 수 있습니다. 보관함 밖 외부 편집기 없이 샘플 데이터를 확인·수정할 때 편리합니다.
- **Git**(Obsidian Git): 실험 노트 보관함을 Git으로 버전 관리·백업합니다. 자동 커밋/동기화로 변경 이력을 남기고 여러 기기 간에 안전하게 옮길 수 있습니다.

## 주요 명령어

명령 팔레트에는 영문 이름으로 등록됩니다(괄호 안).

| 명령어 | 설명 |
|---|---|
| 날짜 삽입 (`Insert date`) | 현재 날짜 삽입 |
| 날짜 및 시간 삽입 (`Insert date and time`) | 현재 타임스탬프 삽입 |
| 실험 생성 (`Create experiment`) | 새 `.labnote.md` 실험 노트 생성 |
| 실험 상태 변경 (`Change experiment status`) | 활성 실험의 `status` frontmatter를 피커로 변경 |
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

명령 팔레트에서 **연구노트 자동화 설정**(`Setup research automation`)을 실행하세요. 아래 파일들을 현재 보관함에 기록합니다 — 상위 폴더를 만들고, 덮어쓰기 전에는 확인을 받으며, 기존 `.gitignore`에는 누락된 줄만 *추가*합니다. 이후 일회성 설정 절차는 생성된 `SETUP.md`가 안내합니다.

| 영역 | 파일 | 하는 일 |
| --- | --- | --- |
| 대용량 파일 보호 | `scripts/check-large-files.mjs`, `.githooks/pre-commit`, `.gitignore` | 커밋 전에 과도하게 큰 데이터 파일을 차단(Node 없으면 shell로 대체). |
| 검증 | `scripts/validate.mjs`, `.github/workflows/validate.yml` | push마다 `status` 값과 실험 id 중복을 검사. |
| Experiment ↔ Issue | `scripts/issue-sync.mjs`, `.github/workflows/experiment-issues.yml`, `.github/ISSUE_TEMPLATE/experiment.md` | `discuss: true` 또는 `status: needs-review`인 실험마다 Issue를 생성/갱신(결정적, GitHub REST API). |
| AI 맥락 게이트(선택) | `scripts/issue-gate.mjs`, `ai/prompts/*`, `ai/schemas/*` | self-hosted 로컬 LLM이 자유 서술 노트가 실제로 논의가 필요한지 판단. |
| Living-Manuscript Wiki(선택) | `scripts/wiki-propose.mjs`, `.github/workflows/wiki-sync.yml`, `wiki-staging/*` | 완료된 실험에서 객관적 사실만 추출해 논문형 Wiki 골격에 배치, 사람 검토용으로 스테이징. |

번들된 스크립트는 **무의존성** Node ESM입니다: labnoteo의 `@labnoteo/core` 함수를 그대로 재사용하므로 플러그인과 드리프트가 없고, `node scripts/*.mjs`로 실행됩니다 — 보관함에서 `npm install`이 필요 없습니다.

**전제 조건 및 범위**

- 어떤 Actions든 동작하려면 보관함이 GitHub 저장소여야 합니다(먼저 push). 연구 데이터가 있으면 **private**로 유지하세요.
- AI 단계는 노트가 네트워크 밖으로 나가지 않도록 **self-hosted 러너 + 로컬 LLM** 엔드포인트가 필요합니다. repo variables `LLM_ENDPOINT` / `LLM_MODEL`을 설정하세요. Wiki는 별도 저장소이므로 `wiki-sync.yml`은 PAT(`GH_WIKI_TOKEN`)가 추가로 필요할 수 있습니다.
- 자동화는 **노트를 절대 되쓰지 않습니다** — Issue를 열고 Wiki 제안을 스테이징만 하며, 과학적 판단과 `status` 변경은 사람의 몫입니다.
- 플러그인 업데이트 후에는 명령을 다시 실행해 스크립트를 갱신하고, 커밋 전에 diff를 검토하세요.

전체 체크리스트와 단계별 상세는 보관함에 생성된 `SETUP.md`를 참고하세요.

## 설정

**샘플**

- **샘플 추적**: Samples 사이드바 뷰 표시 여부.
- **사용자 정의 샘플 타입**: 내장 타입 외에 사용자 정의 타입 추가.
- **글로벌 샘플 폴더**: 보관함 전역 샘플 저장소 폴더 (기본 `resources/labsamples`).

**AI 제공자**

- **제공자**: `none`, `ollama`, `openai`. 플러그인이 제공자와 직접 통신합니다.
- **Ollama 엔드포인트** / **OpenAI 엔드포인트**: 기본 URL. 제공자를 바꿀 때 OpenAI 키가 로컬 Ollama 주소로 새어 나갈 수 없도록 필드를 분리해 두었습니다.
- **모델**: 모델 id. 예: `qwen3`, `gpt-4o-mini`.
- **API 키**: OpenAI 호환 제공자에만 사용되며, Ollama로는 절대 전송되지 않습니다.

> **툴 호출에는 지원 모델이 필요합니다.** *어시스턴트에게 요청*과 MCP 툴은 제공자의 함수 호출(function calling) 기능에 의존합니다. Ollama에서는 모델이 `tools` capability를 지원해야 하며(`qwen3`, `llama3.1` 등), 그렇지 않은 모델은 툴을 요청하지 않고 산문으로 답합니다. 이때 그럴듯한 JSON을 본문에 출력하기도 하지만 실행되지 않습니다.

**MCP 서버** — 아래 절 참고.

## MCP 서버 (데스크톱 전용)

MCP 서버를 켜면 Labnote의 툴(`get_sample`, `list_samples`, `create_sample`, `get_unit_operation`, `update_section`, `create_workflow`)을 Claude Desktop 같은 외부 MCP 클라이언트에 노출합니다.

- **엔드포인트**: `http://127.0.0.1:3987` — 루프백 전용이며 라우팅 가능한 인터페이스에는 바인딩하지 않습니다.
- **인증**: 세션마다 무작위로 생성되는 베어러 토큰. 서버가 실행 중일 때 설정 → **MCP 토큰**에서 복사하세요. 서버를 재시작할 때마다 바뀝니다.
- **쓰기는 확인을 거칩니다**: 보관함을 수정하는 툴은 실행 전에 대상 경로와 함께 확인을 요청합니다. 경로를 고르는 것은 모델이기 때문입니다.

서버는 MCP `2025-06-18` 개정을 **무상태(stateless)** 서버로 구현합니다: `initialize`, `tools/list`, `tools/call`. 서버에서 밀어낼 메시지가 없으므로 `GET`에는 `405`로 답하며, DNS 리바인딩 방어를 위해 `Origin` 헤더를 검증합니다. 인증이 사양의 OAuth 흐름이 아니라 베어러 토큰이므로, 클라이언트가 커스텀 `Authorization` 헤더를 설정할 수 있어야 합니다.

## Copilot(에이전트 모드) + Claude Code 함께 쓰기 (선택)

Copilot 플러그인의 **에이전트 모드**는 이 컴퓨터에 설치된 CLI 에이전트(OpenCode / **Claude Code** / Codex)를 그대로 실행합니다. "Claude"를 고르면 Copilot이 로컬 `claude`(Claude Code) CLI를 구동하며, 인증은 **API 키가 아니라 CLI에 로그인된 Claude 구독 계정**(Pro/Max/Team/Enterprise)을 사용합니다.

### 1) Claude Code 설치 & 로그인

1. Copilot 설정 → **Basic → Agents → Claude → Configure**의 *Install Claude Code*에 표시된 설치 명령을 실행합니다. 예를 들어 Windows PowerShell에서는 아래 한 줄입니다(Copilot 화면의 명령을 그대로 복사해 쓰는 것이 가장 안전합니다):
   ```powershell
   irm https://gist.githubusercontent.com/logancyang/7a87eb38d91015eac567521f8cc9c729/raw/install-claude-agent-mode-windows.ps1 | iex
   ```
2. 설치 중 브라우저 로그인 창이 뜨면 Claude 계정으로 로그인합니다. **구독(Pro/Max/Team/Enterprise) 계정이면 API 키가 필요 없습니다.**
3. 터미널에서 `claude`를 실행해 `/status`로 현재 인증 상태를 확인할 수 있습니다.

> 환경변수 `ANTHROPIC_API_KEY`가 설정돼 있으면 구독 로그인보다 **우선 적용**되어 그 키로 과금됩니다. 구독으로 쓰려면 이 변수를 비워 두세요.

### 2) Copilot에서 Claude 에이전트 연결

1. 설정 → 커뮤니티 플러그인 → **탐색(Browse)**에서 `Copilot`(제작자 logancyang)을 설치·활성화합니다.
2. 설정 → Copilot → **Basic → Agents → Claude → Configure → Auto-detect**를 누릅니다. 자동으로 못 찾으면 위 설치 과정에서 복사된 `claude` 실행 파일 경로를 바이너리 경로 칸에 붙여넣고 저장합니다. ("not in your PATH" 경고는 Copilot이 PATH가 아니라 파일 경로로 찾으므로 무시해도 됩니다.)
3. 명령 팔레트에서 **Open Copilot Agent Chat Window**를 실행하고 **Claude**를 선택한 뒤 메시지를 보냅니다.
4. 노트에서 텍스트를 선택하면 에이전트 모드의 컨텍스트 컨트롤로 선택 텍스트·활성 노트를 대화에 추가할 수 있습니다.

### 3) (선택) Labnote 툴을 Claude에 연결 — MCP

Claude Code에 labnoteo의 MCP 서버를 등록하면, **터미널에서 쓰든 Copilot 에이전트 모드에서 쓰든 같은 `claude` 바이너리**가 Labnote 툴(`get_sample`, `list_samples`, `create_sample`, `get_unit_operation`, `update_section`, `create_workflow`)을 직접 호출할 수 있습니다. **데스크톱 전용**입니다.

1. Obsidian 명령 팔레트에서 **Toggle MCP server**를 실행하고, 설정 → **MCP 토큰**에서 현재 토큰을 복사합니다(서버를 껐다 켤 때마다 새로 발급됩니다).
2. 복사한 토큰으로 등록합니다:
   ```bash
   claude mcp add --transport http labnoteo http://127.0.0.1:3987 \
     --header "Authorization: Bearer <복사한-토큰>"
   ```
3. `claude mcp list`로 `labnoteo` 연결을 확인하고, Claude Code 안에서 `/mcp`로 상태를 봅니다.
4. 이후 자연어로 지시하면 됩니다. 예: "list_samples로 이 보관함의 DNA 샘플을 보여줘", "update_section으로 현재 실험 노트의 Method 섹션 초안을 채워줘".

**주의**

- **토큰 갱신**: MCP 서버를 껐다 켜면 토큰이 바뀝니다. 다시 등록하려면 `claude mcp remove labnoteo` 후 새 토큰으로 다시 `add`하세요.
- **쓰기 확인**: 보관함을 수정하는 툴(`create_sample`, `update_section`, `create_workflow`)은 실행 전에 Obsidian이 대상 경로와 함께 확인창을 띄웁니다. 경로를 고르는 주체가 모델이기 때문입니다.
- **바인딩 범위**: 서버는 `127.0.0.1`(루프백)에만 바인딩되며 다른 인터페이스에는 노출되지 않습니다.
- **헤더 이슈**: 일부 Claude Code 버전(특히 Windows)에서 툴 호출 시 `Authorization` 헤더가 누락돼 `401`이 나는 알려진 문제가 있습니다. 이 서버는 헤더 인증만 지원하므로, 401이 반복되면 Claude Code를 최신 버전으로 업데이트하세요.

## 개발자 참고

npm workspaces 모노레포 구조입니다:

- `src/` — Obsidian 플러그인. esbuild로 저장소 루트의 `main.js`로 번들됩니다. Obsidian 커뮤니티 디렉터리가 루트의 `manifest.json`을 읽기 때문에 플러그인이 루트에 있습니다.
- `packages/labnoteo-core` — 플랫폼 중립 core 로직 (파서, 워크플로/샘플 도메인). 플러그인이 사용합니다. Node 전용 API를 import하면 안 되며, 플랫폼 의존 기능은 포트(`LabnoteFs`, `LabnoteHost`) 뒤에 둡니다.
- `automation/` — 보관함에 설치되는 [연구노트 자동화](#연구노트-자동화) 스크립트의 소스. esbuild가 (1단계) 무의존성 `dist-automation/*.mjs`로 번들하고 — 플러그인과 같은 `@labnoteo/core` 소스를 재사용하므로 드리프트가 없음 — (2단계) 워크플로/프롬프트/Wiki 템플릿과 함께 `main.js`에 문자열로 임베드합니다. 덕분에 3-파일 설치만으로 자립합니다. *연구노트 자동화 설정* 명령이 그 문자열을 보관함에 기록합니다.
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
