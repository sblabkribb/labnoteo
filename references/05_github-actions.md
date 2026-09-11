# 05. GitHub Actions 자동화 상세 설계

> **목표:** 연구자는 Obsidian에서 연구노트를 작성하고 Git push만 하면 되도록 하고, 이후의 형식 검사·실험 감지·Issue 생성·상태 관리·대용량 파일 검사·향후 AI 연결을 GitHub Actions가 담당하도록 한다.

---

## 1. 자동화의 기본 원칙

자동화의 목적은 연구자가 GitHub Actions 자체를 의식하지 않게 만드는 것이다.

```text
연구자
  │
  ▼
Obsidian에서 노트 작성
  │
  ▼
commit / push
  │
  ▼
GitHub Actions
  ├─ 파일 검사
  ├─ 연구노트 구조 검사
  ├─ Experiment 탐지
  ├─ Issue 확인/생성
  ├─ Label 관리
  └─ AI 작업 후보 생성
```

단, 다음은 자동화하지 않는 것을 기본값으로 한다.

- 과학적 결론 확정
- 실패/성공의 과학적 판단
- Decision 자동 승인
- Wiki의 주장 자동 변경
- 원본 연구노트의 무분별한 자동 수정

**기계적인 일은 자동화하고, 과학적인 판단은 사람이 승인한다.**

---

## 2. 자동화 계층을 두 단계로 나눈다

대용량 파일 문제와 형식 오류는 push 전에 잡는 것이 가장 좋다.

따라서 자동화를 두 계층으로 나눈다.

### Local — push/commit 전

```text
Obsidian / Local Git
       │
       ├─ large file check
       ├─ forbidden file check
       └─ optional metadata check
```

### GitHub — push 후

```text
GitHub Actions
       │
       ├─ validation
       ├─ experiment detection
       ├─ Issue creation
       ├─ label management
       ├─ reports
       └─ AI integration
```

둘은 서로 대체 관계가 아니다.

Local hook이 실수의 첫 번째 방어선이고 GitHub Actions가 중앙 검증 계층이다.

---

## 3. 권장 Repository 구조

```text
Research-Vault/
│
├── 01_Projects/
├── 02_Protocols/
├── 03_Resources/
├── 04_Decisions/
├── 05_Manuscript/
├── 90_Templates/
├── assets/
│
├── scripts/
│   ├── validate_notes.py
│   ├── changed_experiments.py
│   ├── check_large_files.py
│   └── build_issue_body.py
│
├── .github/
│   ├── workflows/
│   │   ├── validate.yml
│   │   ├── experiment-issues.yml
│   │   └── ai-assistant.yml
│   │
│   └── ISSUE_TEMPLATE/
│       └── experiment.md
│
├── .githooks/
│   └── pre-commit
│
├── .gitignore
└── README.md
```

처음부터 모든 파일을 구현할 필요는 없다.

---

## 4. Workflow를 하나의 거대한 파일로 만들지 않는다

초기에는 최소 2개로 분리하는 것이 좋다.

```text
validate.yml
    └─ 안전성/형식 검사

experiment-issues.yml
    └─ Experiment ↔ Issue 자동화
```

AI를 추가할 때:

```text
ai-assistant.yml
```

을 별도로 추가한다.

이렇게 하면 AI 오류가 기본 Git workflow에 영향을 주지 않는다.

---

## 5. Workflow 1 — Validation

`.github/workflows/validate.yml`

역할:

```text
push / pull request
        ↓
변경 파일 확인
        ↓
큰 파일 검사
        ↓
Markdown 검사
        ↓
Experiment metadata 검사
        ↓
PASS / FAIL
```

예시 골격:

```yaml
name: Validate Research Notes

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.x"

      - name: Install dependencies
        run: |
          pip install pyyaml

      - name: Validate research notes
        run: |
          python scripts/validate_notes.py

      - name: Check large files
        run: |
          python scripts/check_large_files.py
```

실제 Action 버전은 구현 시점에 최신 안정 버전을 확인하여 고정하는 것이 좋다.

---

## 6. Experiment validation

예를 들어 다음 노트가 있다.

```yaml
---
type: experiment
id: EXP-025
project: PRJ-001
status: in-progress
date: 2026-09-10
---
```

validator는 최소한 다음을 확인한다.

```text
type == experiment
      ↓
id 존재?
      ↓
EXP-[0-9]+ 형식?
      ↓
status 허용값?
      ↓
중복 ID 존재?
```

허용 status:

```text
planned
in-progress
needs-review
completed
failed
discontinued
needs-repeat
```

---

## 7. Validation은 너무 엄격하게 시작하지 않는다

초기부터 모든 필드를 필수로 만들면 노트 작성이 불편해진다.

### 필수

```text
type
id
status
```

### 권장

```text
project
date
```

### 선택

```text
issue
data
tags
assignee
```

정도로 시작하는 것이 좋다.

---

## 8. 대용량 파일 — GitHub Action만으로는 부족하다

GitHub에서 검사하면 이미 파일을 push하려고 시도한 뒤다.

따라서 **local pre-commit 검사**가 먼저 필요하다.

권장 예:

```text
0–10 MB
→ 허용

10–50 MB
→ 경고

50 MB 이상
→ 기본적으로 commit 차단
```

실제 기준은 연구팀 정책에 맞춰 조정한다.

---

## 9. pre-commit의 동작

```text
git commit
    │
    ▼
staged files 검사
    │
    ├─ 정상 → commit
    │
    └─ 큰 파일
          ↓
       commit 중단
          ↓
       안내 메시지
```

예:

```text
ERROR: Large research data detected

File:
01_Projects/Project-A/data/sample.fastq

Size:
1.4 GB

This file should not be committed to Git.

Move the file to research data storage and reference
its storage ID or URI from the experiment note.
```

---

## 10. 자동 이동은 하지 않는다

다음과 같은 자동화는 피한다.

```text
large file detected
      ↓
자동으로 NAS 폴더로 이동
```

이유:

- Obsidian attachment link가 깨질 수 있음
- 분석 코드 경로가 깨질 수 있음
- 사용자가 의도하지 않은 데이터 이동 가능
- NAS 연결이 없는 환경에서 실패 가능
- 데이터 관리 정책과 충돌 가능

따라서:

```text
Detect
  ↓
Block
  ↓
Explain
  ↓
User decides
```

가 더 안전하다.

---

## 11. `.gitignore`

명확하게 Git에 들어오면 안 되는 형식은 미리 제외한다.

예:

```gitignore
# Raw sequencing data
*.fastq
*.fastq.gz
*.fq
*.fq.gz
*.bam
*.cram

# Large instrument exports
raw-data/
instrument-data/

# Temporary files
.DS_Store
Thumbs.db
```

그러나 확장자만으로 연구 데이터를 판단할 수 없기 때문에 size check도 함께 사용한다.

---

## 12. Workflow 2 — 변경된 Experiment 탐지

`.github/workflows/experiment-issues.yml`

핵심은 **Repository 전체를 매번 처리하지 않고 이번 push에서 변경된 파일만 보는 것**이다.

```text
push
 ↓
git diff
 ↓
changed *.md
 ↓
Frontmatter parse
 ↓
type: experiment?
 ↓
YES
 ↓
EXP ID 추출
```

---

## 13. 신규 실험과 기존 실험 구분

예:

```text
EXP-025.md 변경
     ↓
GitHub Issue 검색

"[EXP-025]"
     ↓
┌───────────────┐
│ Issue 있음?   │
└───────┬───────┘
        │
   YES  │  NO
    │   │
    ▼   ▼
 update create
```

하지만 초기 MVP에서는 기존 Issue의 본문을 매 push마다 갱신하지 않는 것을 권장한다.

즉:

```text
Issue 없음 → 생성
Issue 있음 → 아무것도 하지 않음
```

부터 시작한다.

---

## 14. 왜 Issue를 계속 자동 업데이트하지 않을까?

연구노트의 제목이나 상태가 바뀔 때마다 Issue 본문을 덮어쓰면 사람이 Issue에서 추가한 맥락과 자동화가 충돌할 수 있다.

따라서 Issue를 두 영역으로 생각한다.

```text
자동 생성 영역
+
사람의 Discussion 영역
```

자동화는 최소한으로 유지한다.

상태 Label 정도만 선택적으로 동기화한다.

---

## 15. Issue 검색 키는 EXP ID

가장 중요한 원칙:

> **GitHub Issue 번호가 아니라 Experiment ID가 연결의 기준이다.**

예:

```text
EXP-025
```

를:

- Markdown 파일
- Issue title
- Data storage
- Wiki Evidence
- Decision Note

모두에서 사용한다.

Issue 검색:

```text
[EXP-025]
```

이렇게 하면 GitHub에서 GitLab으로 이동해도 연구 ID 체계는 유지된다.

---

## 16. Issue 자동 생성

자동 생성되는 Issue:

```markdown
# EXP-025 — Insert ratio test

## Research Note

Repository link to EXP-025

## Objective

Compare insert ratios in Golden Gate assembly.

## Status

in-progress

## Experiment ID

EXP-025

---

Use comments for:

- questions
- interpretation
- troubleshooting
- suggestions
- follow-up experiments
```

전체 노트를 복사하지 않는다.

---

## 17. Issue URL을 원본 노트에 자동으로 쓰지 않는 이유

Issue가 생성된 뒤 Action이:

```yaml
issue: 73
```

을 Markdown에 자동 추가하고 commit할 수도 있다.

그러나:

```text
push
 ↓
Action
 ↓
file 수정
 ↓
commit
 ↓
push
 ↓
Action 재실행
```

이라는 loop가 생길 수 있다.

또 Obsidian 로컬에는 없는 commit이 원격에서 생겨 다음 push 때 conflict 가능성이 높아진다.

따라서 MVP에서는 **Repository를 Action이 수정하지 않는다.**

---

## 18. Push 이후 Repository를 불변처럼 취급한다

권장 방향:

```text
Local/PR
   │
   ▼
Repository 변경
   │
   ▼
Automation은 외부 metadata 생성
   ├─ Issue
   ├─ Label
   ├─ Check
   └─ Proposal
```

즉 자동화가 원본 Markdown을 다시 쓰지 않는 것이 기본이다.

이 원칙은 시스템을 상당히 단순하게 만든다.

---

## 19. Status Label 동기화

이 부분은 비교적 안전하게 자동화할 수 있다.

예:

```yaml
status: completed
```

push 후:

```text
기존:
status:in-progress

변경:
status:completed
```

Issue에서 기존 `status:*` Label을 제거하고 새 Label을 붙인다.

단, 연구자가 Issue에서 status Label을 직접 바꿀 수도 있다면 **어느 쪽이 SSOT인지 먼저 정해야 한다.**

권장:

> 연구 상태의 SSOT는 Experiment Note의 Frontmatter.

Issue는 이를 표시하는 view로 사용한다.

---

## 20. Issue Close 자동화는 보수적으로

예:

```yaml
status: completed
```

이라고 해서 Issue를 즉시 Close하지 않는다.

완료된 실험이라도:

- 해석 논의
- 결과 리뷰
- 후속 실험 논의

가 남아 있을 수 있기 때문이다.

따라서:

```text
Experiment status
→ Label 자동화

Issue Open/Closed
→ 사람 결정
```

을 권장한다.

---

## 21. GitHub Actions 권한

Issue를 생성하려면 workflow에 필요한 권한을 명시해야 한다.

개념적으로:

```yaml
permissions:
  contents: read
  issues: write
```

정도로 최소 권한 원칙을 적용한다.

Wiki 또는 PR을 다루게 되면 그때 필요한 권한만 추가한다.

---

## 22. Secret 관리

기본 GitHub API 작업은 가능한 경우 GitHub가 workflow에 제공하는 token을 사용한다.

AI API를 연결하면 별도 Secret이 필요할 수 있다.

예:

```text
AI_API_KEY
```

절대로:

```yaml
api_key: sk-....
```

처럼 workflow 파일이나 Obsidian 노트에 직접 기록하지 않는다.

Repository Settings의 Actions secrets/variables를 사용한다.

---

## 23. Fork와 외부 공동연구자

외부 collaborator가 PR을 만드는 경우 Secret이 포함된 AI workflow를 무조건 실행시키지 않도록 주의해야 한다.

따라서 AI 자동화는:

```text
main branch push
```

또는 승인된 workflow에서만 실행하는 편이 좋다.

Validation은 PR에서 실행해도 된다.

---

## 24. AI는 별도 Workflow

권장:

```text
validate.yml
experiment-issues.yml
ai-assistant.yml
```

`ai-assistant.yml`은 다음과 같은 조건에서만 실행한다.

```text
Experiment status → completed
```

또는 Label:

```text
ai-review
```

가 붙었을 때.

AI 호출을 모든 push마다 수행하면:

- 비용 증가
- 불필요한 요약
- rate limit
- noise

가 발생한다.

---

## 25. AI workflow의 역할

예:

```text
EXP-025 completed
      ↓
AI Assistant
      ↓
Research Note 분석
      ↓
Issue comments 분석
      ↓
생성:
  - summary
  - unresolved questions
  - decision candidates
  - wiki update candidate
```

결과는 원본 노트에 쓰지 않는다.

---

## 26. AI 결과를 어디에 둘까?

초기에는 해당 Issue에 댓글로 남기는 방법이 가장 단순하다.

예:

```markdown
## AI Research Summary

### Key observations

...

### Unresolved questions

...

### Possible decision

...

### Possible Wiki update

...

> AI-generated draft. Scientific interpretation requires review.
```

이렇게 하면 별도 파일을 계속 생성하지 않아도 된다.

---

## 27. Wiki Update Proposal

AI가 Wiki를 직접 수정하는 대신 Proposal을 만든다.

예:

```text
Issue comment
```

또는 별도의 Issue:

```text
[WIKI-PROPOSAL] Update Finding 03 with EXP-025
```

후자가 필요할 정도로 프로젝트가 커지기 전에는 기존 Experiment Issue 댓글이 더 단순하다.

---

## 28. 자동화 Trigger 전략

### Validation

```text
push
pull_request
```

### Experiment Issue

```text
push to main
```

### AI

```text
manual
또는
specific label/event
```

정도로 시작하는 것을 권장한다.

---

## 29. Obsidian Git 자동 push와의 관계

Obsidian Git 플러그인이 예를 들어 주기적으로 commit/push한다면 작은 변경마다 Action이 실행될 수 있다.

따라서 Workflow에서:

```text
Markdown 변경이 있는가?
Experiment 변경이 있는가?
```

를 먼저 검사하여 불필요한 job을 줄인다.

또는 path filter를 사용한다.

개념 예:

```yaml
on:
  push:
    paths:
      - "**/*.md"
```

대용량 파일 검사는 별도 정책에 따라 모든 push에서 수행할 수도 있다.

---

## 30. Commit 메시지는 자동화의 핵심 키로 사용하지 않는다

예:

```text
experiment completed
```

같은 commit message를 분석해 자동화를 결정하면 사용자가 규칙을 기억해야 한다.

대신:

```yaml
type: experiment
status: completed
```

같은 구조화된 metadata를 사용한다.

Frontmatter가 automation contract 역할을 한다.

---

## 31. 오류가 발생하면 어떻게 보여줄까?

연구자가 Python traceback을 읽게 만들면 안 된다.

좋은 오류:

```text
Research Note Validation Failed

File:
01_Projects/Lycopene/Experiments/EXP-025.md

Problem:
Unknown experiment status: "done"

Allowed values:
planned
in-progress
needs-review
completed
failed
discontinued
needs-repeat

Suggested fix:
status: completed
```

자동화의 UX도 연구노트 시스템의 일부다.

---

## 32. 중복 EXP ID 방지

매우 중요한 검사다.

예:

```text
Project-A/EXP-025.md
Project-B/EXP-025.md
```

가 동시에 존재한다면 ID가 전역 고유인지 프로젝트 내부 고유인지 정책을 정해야 한다.

권장 초기 정책:

> Repository 전체에서 EXP ID를 고유하게 유지한다.

그러면 Wiki, Issues, Data Storage 연결이 훨씬 단순해진다.

---

## 33. 삭제된 Experiment

연구노트를 삭제했다고 Issue까지 자동 삭제하지 않는다.

삭제는 위험한 자동화다.

대신 Action이 경고할 수 있다.

```text
EXP-025 research note was removed.

Related GitHub Issue may still exist.

No automatic deletion was performed.
```

연구 기록의 삭제는 명시적인 사람의 판단으로 처리한다.

---

## 34. Rename 처리

파일:

```text
EXP-025_test.md
```

를:

```text
EXP-025_temperature-test.md
```

로 변경해도 ID가 동일하면 같은 Experiment다.

따라서 자동화는 **파일 경로보다 Frontmatter의 ID를 우선**한다.

---

## 35. GitHub Action의 전체 논리

```text
                   PUSH
                     │
                     ▼
              Changed Files
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
      Large File?           Markdown?
          │                     │
       YES│                     ▼
          ▼               Parse Frontmatter
        FAIL                    │
                                ▼
                         type: experiment?
                           │          │
                          NO         YES
                           │          │
                           ▼          ▼
                         Ignore    Validate ID
                                      │
                                      ▼
                               Search GitHub Issue
                                │             │
                             exists         missing
                                │             │
                                ▼             ▼
                           Sync label      Create Issue
                                │             │
                                └──────┬──────┘
                                       ▼
                                  Finish
```

---

## 36. MVP 구현 순서

### Step 1

`.gitignore`

### Step 2

local large-file pre-commit hook

### Step 3

`validate.yml`

### Step 4

Experiment Frontmatter validation

### Step 5

`experiment-issues.yml`

### Step 6

Issue 자동 생성

### Step 7

status Label 동기화

여기까지 먼저 안정화한다.

---

## 37. 2단계 자동화

MVP가 안정되면:

```text
AI summary
Decision candidate
Wiki proposal
```

을 추가한다.

---

## 38. 3단계 자동화

더 발전시키면:

```text
Evidence graph generation
Data storage validation
Experiment dashboard
Manuscript progress
RAG
Research agent
```

등을 연결할 수 있다.

---

## 39. 최종 사용자 경험

이 시스템이 잘 만들어지면 연구자의 일상은 매우 단순해야 한다.

```text
Obsidian 실행
     ↓
연구노트 작성
     ↓
저장
     ↓
Obsidian Git 자동 commit/push
     ↓
끝
```

뒤에서는:

```text
GitHub
  ├─ validation
  ├─ backup/history
  ├─ Experiment tracking
  ├─ Issue creation
  ├─ collaboration
  ├─ status management
  └─ AI assistance
```

가 동작한다.

즉 **자동화가 연구 workflow를 바꾸는 것이 아니라 기존 연구 workflow 뒤에 붙는 것**이 핵심이다.

---

## 40. 구현 시 특히 지켜야 할 원칙

1. Action이 원본 연구노트를 함부로 수정하지 않는다.
2. Experiment ID를 시스템 간 공통 식별자로 사용한다.
3. GitHub Issue 번호에 시스템을 종속시키지 않는다.
4. 큰 파일은 push 후가 아니라 commit 전에 먼저 막는다.
5. GitHub에서도 다시 검증하여 우회 경로를 막는다.
6. 모든 Issue 댓글을 Repository로 복사하지 않는다.
7. AI 결과는 먼저 제안으로 만든다.
8. 과학적 결론과 Wiki 주장은 사람이 승인한다.
9. 자동화 오류 메시지는 연구자가 이해할 수 있게 작성한다.
10. 처음에는 단순하게 구축하고 사용 경험을 보면서 확장한다.

---

## 41. 다음 문서

다음 문서는:

`06_ai-automation.md`

에서 AI 계층을 상세하게 설계한다.

주요 내용:

- Obsidian AI와 서버/GitHub AI의 역할 분리
- 연구노트 자동 요약
- Issue 댓글 요약
- unresolved question 추출
- Decision 후보 생성
- 다음 실험 후보 생성
- Wiki Update Proposal
- Evidence 기반 RAG
- hallucination 방지
- 사람 승인(Human-in-the-loop)
- API 기반 AI와 향후 로컬 LLM의 교체 가능 구조
- 연구 데이터 보안
- 향후 MCP/Research Agent 확장

이 단계에서는 특정 AI 공급자에 시스템을 강하게 묶기보다 **교체 가능한 AI 계층**으로 설계하는 것이 중요하다.
