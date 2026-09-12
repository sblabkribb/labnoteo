# Labnote 연구노트 — AI 에이전트 규칙

> 이 블록은 labnoteo 플러그인의 "연구노트 자동화 설정" 명령이 관리합니다.
> 재실행 시 마커 사이 내용만 갱신되므로, **사용자 규칙은 마커 바깥에** 작성하세요.

이 보관함(vault)은 Obsidian 기반 연구노트 저장소입니다. AI 에이전트(Claude Code,
Cursor 등)는 아래 규칙을 따라 작업합니다.

## Git 워크플로우 + 커밋 메시지

- 네이티브 `git`을 사용합니다 (Obsidian Git 플러그인 불필요).
- 최초 1회 `git config core.hooksPath .githooks`를 실행해 pre-commit 훅을 활성화합니다.
- 커밋 전 `node scripts/check-large-files.mjs`로 대용량 파일을 확인합니다.
- `git commit --no-verify`는 **금지**입니다 (대용량 훅 우회 방지).
- push 전 `node scripts/validate.mjs`가 통과하는지 확인합니다.
- 커밋 메시지는 **변경 내용을 기반으로 직접 작성**합니다:
  - Conventional Commits 형식 (`feat:`, `fix:`, `docs:`, `chore:` 등).
  - 관련 실험이 있으면 식별자(`EXP-###` 또는 폴더명 `###_Name`)를 본문 또는 제목에 포함.
  - 빈 메시지, `@`, 자리표시자 메시지 금지.
  - 예: `docs(labnote): EXP-003 PCR 조건 3차 시도 결과 기록`

## 커밋 금지 대상

- 대용량 원시데이터 (`*.fastq*`, `*.bam`, `raw-data/` 등 — `.gitignore` 참고).
- 시크릿/토큰/API 키.
- Obsidian 개인 상태 (`.obsidian/workspace.json`, `workspace-mobile.json`).
- AI 에이전트 상태 폴더 (`.claude/`, `.copilot/`, `.opencode/`, `.agents/`).

## 연구노트 규칙

- 단일 진실 소스(SSOT)는 `labnote/<###_이름>/README.labnote.md`입니다.
  Issue/Wiki는 협업·지식 레이어일 뿐 노트의 사본이 아닙니다.
- frontmatter의 `status` / `project` / `id`는 **확장만** 합니다(필드 추가는 가능,
  기존 값을 임의로 되쓰지 않음).
- `discuss: true`는 "논의 신호" 필드입니다 — 에이전트가 설정할 수 있으며
  `status`와는 별개입니다 (아래 Playbook A).
- `status` 허용값: `planned`, `in-progress`, `needs-review`, `completed`,
  `failed`, `discontinued`, `needs-repeat`.

## Playbook A — 토론 이슈 판단 (이슈는 직접 만들지 않음)

변경한(또는 검토를 요청받은) 노트의 자유 서술에 논의가 필요한 정황이 보이면
("이슈", "논의 필요", "문의", "결정 필요" 등 표현 또는 그에 준하는 내용) 맥락을
판단합니다:

- **`discuss: true`를 설정할 것** (사용자에게 확인 후): 구체적이고 **미해결**인
  사안일 때만 — 예: 이상/실패의 후속 조치 필요, 명시적 검토/결정 요청, 진행을
  막는 문제, 합의가 필요한 프로토콜 변경.
- **설정하지 말 것**: 일상적 진행 기록, 이미 해결된 사안, 실체 없는 단순 언급
  (예: "재현성 이슈가 있었다"는 지나가는 말). **애매하면 설정하지 않습니다.**
- GitHub Issue를 **직접 생성하지 마세요** — push 후 서버측 `issue-sync`가
  `discuss: true` / `status: needs-review` 노트를 `[식별자]` 마커로 멱등
  생성/갱신합니다. 직접 만들면 중복이 됩니다.
- `status`를 `needs-review`로 바꾸는 것은 라이프사이클 변경이므로 에이전트가
  하지 않습니다(사람 또는 플러그인의 *Change experiment status* 명령 몫).

## Playbook B — Wiki 초안 (사실 연결만, 발행하지 않음)

`wiki-staging/`의 논문형 섹션(Methods, Results 등)에 노트의 내용을 반영할 때:

- 노트에서 **객관적 사실만** 추출합니다 (수행한 행동, 측정값, 관찰 결과).
  해석·의견·결론·요약은 **금지**합니다 — 그것은 사람의 몫입니다.
- 각 문장에는 근거 식별자(`EXP-###` 또는 폴더명)를 붙입니다. 근거를 특정할 수
  없는 내용은 추가하지 않습니다.
- 기존 섹션 내용은 **보존**하고, 진짜 새로운 사실만 추가합니다. 이미 있는
  사실을 중복 기재하지 않습니다.
- GitHub Wiki에 **직접 쓰지 마세요** — `wiki-staging/`은 사람이 검토하는 초안
  공간이며, main에 머지된 뒤 서버측 `wiki-sync` 워크플로우가 발행합니다.

## 자동화와의 경계 (중복 방지)

- 이슈 생성/갱신: 서버 `issue-sync` 담당 (에이전트는 `discuss: true` 신호만).
- Wiki 발행: 서버 `wiki-sync` 담당 (에이전트는 `wiki-staging/` 초안만).
- 검증: 서버 `validate` 워크플로우가 최종 게이트 (에이전트는 push 전 로컬 실행).
- `status` 자율 변경 금지 — 변경이 필요해 보이면 사용자에게 제안만 합니다.
