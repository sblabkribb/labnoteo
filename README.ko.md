# Labnote Assistant for Obsidian (labnoteo)

**버전 0.78.0**

생물학·생명정보학 실험을 위한 Obsidian용 Markdown 기반 실험 노트입니다. 샘플 추적, 워크플로 체크리스트, 유닛 오퍼레이션, 선택적 LLM 보조 기능을 제공합니다.

이 저장소는 Labnote Assistant의 Obsidian 포팅 버전입니다. 파싱·도메인 로직은 동반 VS Code 확장과 개념을 공유하지만, 이 저장소 안에서 완전히 자립적으로 동작합니다.

## 주요 기능

- **샘플 추적**: 전용 Samples 사이드바 뷰. 샘플(DNA, RNA, Plasmid 및 사용자 정의 타입)을 정의·삽입·편집·검색합니다. 로컬(노트)/글로벌 범위 간 이동을 지원합니다.
- **워크플로 체크리스트**: Workflows 사이드바 뷰에서 번호가 매겨진 워크플로 노트를 생성·관리하고, 유닛 오퍼레이션을 삽입하며 목차를 자동 동기화합니다.
- **유닛 오퍼레이션**: 내장 카탈로그에서 하드웨어/소프트웨어 유닛 오퍼레이션을 삽입하고, 헤딩 정규화와 목차를 자동 갱신합니다.
- **CSV 내보내기**: 노트의 표를 CSV로 내보냅니다.
- **샘플 자동완성·하이라이트**: 편집 중 샘플 참조에 대한 인라인 제안과 하이라이트를 제공합니다.
- **LLM 보조(선택)**: Ollama 또는 OpenAI로 실험 방법 초안 작성, 결과 요약, 샘플 추출을 수행합니다. *어시스턴트에게 요청* 명령은 한 걸음 더 나아가, 모델이 Labnote의 툴을 직접 호출해 목표를 달성하며 보관함을 수정하기 전에 매번 사용자에게 확인합니다. 같은 툴을 외부 MCP 클라이언트에도 노출할 수 있습니다.

## 주요 명령어

명령 팔레트에는 영문 이름으로 등록됩니다(괄호 안).

| 명령어 | 설명 |
|---|---|
| 날짜 삽입 (`Insert date`) | 현재 날짜 삽입 |
| 날짜 및 시간 삽입 (`Insert date and time`) | 현재 타임스탬프 삽입 |
| 실험 생성 (`Create experiment`) | 새 `.labnote.md` 실험 노트 생성 |
| 워크플로 생성 (`Create workflow`) | 번호가 매겨진 워크플로 노트 생성 |
| 유닛 오퍼레이션 삽입 (`Insert unit operation`) | 카탈로그에서 유닛 오퍼레이션 삽입 |
| 표 CSV 내보내기 (`Export tables to CSV`) | 노트의 표를 CSV로 내보내기 |
| AI: Method 섹션 초안 (`AI: Draft Method section`) | 설정된 LLM으로 실험 방법 초안 작성 |
| AI: 결과 요약 (`AI: Summarize results`) | 설정된 LLM으로 결과 요약 |
| AI: 샘플 정의 추출 (`AI: Extract sample definitions`) | 설정된 LLM으로 노트에서 샘플 추출 |
| AI: 어시스턴트에게 요청 (`AI: Ask assistant (uses tools)`) | 목표를 말하면 모델이 Labnote 툴로 수행 |
| MCP 서버 토글 (`Toggle MCP server`) | 로컬 MCP 서버 시작/중지 |
| 워크플로/샘플 뷰 열기 (`Open workflow view` / `Open sample view`) | 사이드바 뷰 표시 |

> 파일 탐색기에서 워크플로 파일 이름을 바꾸면 README 체크리스트가 새 번호(NNN) 순서로 자동 재정렬되고, 삭제하면 해당 체크리스트 항목과 그 파일이 정의한 샘플이 자동으로 정리됩니다.

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

## 개발자 참고

npm workspaces 모노레포 구조입니다:

- `src/` — Obsidian 플러그인. esbuild로 저장소 루트의 `main.js`로 번들됩니다. Obsidian 커뮤니티 디렉터리가 루트의 `manifest.json`을 읽기 때문에 플러그인이 루트에 있습니다.
- `packages/labnoteo-core` — 플랫폼 중립 core 로직 (파서, 워크플로/샘플 도메인). 플러그인이 사용합니다. Node 전용 API를 import하면 안 되며, 플랫폼 의존 기능은 포트(`LabnoteFs`, `LabnoteHost`) 뒤에 둡니다.
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

## 요구 사항

- Obsidian `1.5.0` 이상.
- 개발 시 Node.js `22+`.

## 라이선스

MIT
