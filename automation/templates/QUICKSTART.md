# 연구노트 퀵스타트 (연구원용)

> 실험하는 연구원을 위한 문서입니다. 저장소 최초 설정(관리자용)은 `.labnoteo/SETUP.md`를 보세요.

## 이 보관함으로 할 수 있는 일

- Obsidian에서 쓰는 **노트가 곧 공식 연구 기록**입니다 (`labnote/` 폴더).
- 노트를 **push하면 자동으로**: 노트 형식이 검증되고, 논의가 필요한 실험은 GitHub Issue가 열립니다.
- 실험에서 확인된 사실은 **Wiki(논문형 초안)** 에 차곡차곡 쌓입니다.
- 커밋·푸시 같은 Git 작업은 **AI 에이전트에게 말로 시키면** 됩니다.

## 시작 전 확인 (1분)

- 관리자가 `.labnoteo/SETUP.md`의 최초 설정(GitHub 저장소 연결, 훅 활성화)을 마쳤는지
  확인하세요. (`.labnoteo/`는 숨김 폴더라 Obsidian 탐색기에는 보이지 않습니다 —
  탐색기 대신 파일 관리자나 에디터로 열어야 합니다.)
- 명령은 Obsidian **명령 팔레트**(Ctrl/Cmd+P)에서 **영문 이름**으로 검색합니다.

## 5분 따라하기

### 1. 실험 만들기

명령 팔레트 → **`Create experiment`** → 실험 이름 입력.
`labnote/###_이름/README.labnote.md`가 생기고, 여기에 목적·방법·결과를 기록합니다.

### 2. 진행 상태 바꾸기

명령 팔레트 → **`Change experiment status`** → 상태 선택
(`planned` → `in-progress` → `completed` / `failed` 등).

### 3. 팀 논의가 필요하면 표시하기

명령 팔레트 → **`Toggle discussion flag`**(논의 표시 전환).
다시 실행하면 표시가 해제됩니다.

진행 상태(`status`)와는 별개입니다. 실험이 `in-progress`인 채로 논의만
올릴 수 있고, 그래서 논의하려고 상태를 억지로 바꿀 필요가 없습니다.

> 본문에 "논의 필요"라고 **쓰기만 해서는 이슈가 생기지 않습니다.** 이 표시가
> 있어야 열립니다. 본문을 읽고 판단하게 하려면 AI 에이전트에게:
> *"이 실험 노트 읽고 논의가 필요해 보이면 discuss 표시해줘"*
> — 에이전트가 맥락을 판단해 (확인 후) 같은 표시를 남깁니다.

### 4. 커밋·푸시하기

AI 에이전트(Claude Code 등)에게 말하면 끝입니다:

> "오늘 작업 커밋하고 푸시해줘"

에이전트는 이 보관함의 `AGENTS.md` 규칙에 따라 커밋 메시지를 자동 작성하고,
대용량 파일 검사를 통과한 뒤 push합니다. (직접 `git add / commit / push` 해도 됩니다.)

### 5. 이슈 자동 생성 확인하기

push하고 잠시 뒤, GitHub 저장소의 **Issues 탭**을 열어 보세요.
`discuss: true`(또는 `status: needs-review`)로 표시한 실험마다 `[실험ID] 제목`
이슈가 자동으로 열려 있습니다 — 여기서 팀원과 논의하면 됩니다.
(실험ID는 frontmatter의 `id`가 있으면 `EXP-###`, 없으면 폴더명 `###_이름`입니다.)

## Wiki에 결과 쌓기 (실험이 마무리되면)

1. AI 에이전트에게: *"이 실험에서 확인된 객관적 사실을 wiki-staging에 정리해줘"*
   — 에이전트가 `wiki-staging/`의 논문형 섹션(Methods, Results 등)에
   **사실 + 근거 실험ID**만 추가합니다 (해석·결론은 사람 몫).
2. 초안을 읽고 검토·수정합니다.
3. 커밋해서 main에 반영하면 GitHub Wiki로 자동 발행됩니다.

## 치트시트

| 하고 싶은 일 | 방법 |
| --- | --- |
| 새 실험 시작 | 명령 팔레트 → `Create experiment` |
| 실험 상태 변경 | 명령 팔레트 → `Change experiment status` |
| 팀 논의 올리기 | 명령 팔레트 → `Toggle discussion flag` → 커밋·푸시 → Issues 탭 확인 |
| 커밋·푸시 | AI 에이전트에게 "커밋하고 푸시해줘" (또는 직접 git) |
| 결과를 Wiki에 반영 | 에이전트에게 "사실을 wiki-staging에 정리해줘" → 검토 → 머지 |
| 대용량 원시데이터 | Git에 넣지 말고 `raw-data/` 등 별도 보관(자동 제외됨), 노트에는 경로/ID만 기록 |
| AI로 방법 초안/결과 요약 | 명령 팔레트 → `AI: Draft Method section` / `AI: Summarize results` |

## 자주 겪는 문제

**push했는데 이슈가 안 생겨요**
- 노트에 논의 표시(`discuss: true`) 또는 `status: needs-review`가 있는지 확인하세요 — 이 신호가 있어야 이슈가 열립니다. 본문에 "논의 필요"라고 적은 것만으로는 열리지 않습니다. 명령 팔레트 → `Toggle discussion flag`로 표시하세요.
- GitHub 저장소의 **Actions 탭**에서 `experiment-issues` 워크플로우가 실행됐는지 확인하세요.

**커밋이 거부돼요 (대용량 파일)**
- 50MB 초과 파일은 커밋이 차단됩니다. 파일을 `raw-data/` 등 Git 밖 보관 위치로 옮기고, 노트에는 경로/ID만 남기세요.
- `git commit --no-verify`로 우회하지 마세요 — 서버 검증에서 다시 걸립니다.

**AI 명령이 응답이 없어요**
- Obsidian 설정 → Labnote Assistant → **Provider**가 `Disabled`가 아닌지(Ollama/OpenAI) 확인하고, 엔드포인트·모델명을 설정하세요.

**노트 검증이 실패해요 (Actions의 validate)**
- `status` 값이 허용 목록(`planned`, `in-progress`, `needs-review`, `completed`, `failed`, `discontinued`, `needs-repeat`)에 있는지, 실험 `id`가 중복되지 않는지 확인하세요.
