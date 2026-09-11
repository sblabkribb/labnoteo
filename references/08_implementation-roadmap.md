# 08. Research Notebook System 구현 로드맵

> **목표:** 지금까지 설계한 Obsidian → Git → GitHub Issues → Wiki → AI → Research Data 구조를 한 번에 완성하려 하지 않고, 현재 연구노트 사용 방식을 최대한 유지하면서 단계적으로 도입한다.

---

# 1. 최종 목표 구조

```text
                    Researcher
                        │
                        ▼
                     Obsidian
                        │
                 Markdown Notes
                        │
                  Obsidian Git
                        │
                        ▼
                 GitHub Repository
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Actions        Issues         Wiki
          │             │             │
          │        Collaboration      │
          │             │        Living Manuscript
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                    AI Layer
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
    Summary        Decision Draft    Wiki Proposal
                        │
                   Human Review
                        │
                        ▼
                  Accepted Knowledge
                        │
                        ▼
                       Paper

Research Data
     │
     ├─ NAS / institutional storage
     ├─ Object Storage
     └─ Archive
          ▲
          │
       EXP-ID
          │
       Obsidian
```

---

# 2. 가장 중요한 구현 원칙

처음부터 다음을 모두 구현하지 않는다.

```text
AI Agent
RAG
Data Catalog
자동 Wiki 작성
완전한 provenance graph
복잡한 metadata schema
```

먼저 연구자가 실제로 매일 사용할 수 있는 최소 시스템을 만든다.

초기 성공 기준은 매우 단순하다.

> **연구자는 Obsidian에서 평소처럼 기록하고 push하면 된다.**

---

# 3. 기존 Vault를 그대로 시작점으로 사용

이미 사용 중인 Obsidian Vault가 있다면 새로운 구조로 전체 파일을 이동시키지 않는다.

먼저 현재 구조를 유지한다.

예:

```text
Existing-Vault/
├── Projects/
├── Notes/
├── Protocols/
├── Meetings/
└── ...
```

그 위에 필요한 규칙만 조금씩 추가한다.

초기 대규모 migration은 피한다.

---

# 4. Phase 0 — 현재 상태 점검

구축 전에 다음을 확인한다.

```text
[ ] Obsidian Vault 위치
[ ] Git repository 여부
[ ] GitHub repository 여부
[ ] Obsidian Git plugin 설정
[ ] 현재 attachment 폴더
[ ] Vault 내부 대용량 파일
[ ] Git에 이미 들어간 대용량 파일
[ ] 팀 공동사용 여부
[ ] private repository 여부
[ ] 연구 데이터 저장 위치
```

특히 이미 Git history에 대용량 파일이 들어갔는지 확인하는 것이 중요하다.

---

# 5. Phase 1 — Git 기반 SSOT 확립

가장 먼저:

```text
Obsidian
   ↓
Git
   ↓
GitHub
```

흐름만 안정화한다.

이 단계에서는 Issue/Wiki/AI가 없어도 된다.

---

# 6. GitHub Repository

연구노트가 비공개 연구정보를 포함한다면 기본적으로 private repository를 권장한다.

Repository에는 다음을 둔다.

```text
Research Notes
Protocols
Decision Notes
Templates
Analysis Code
Small Figures
Metadata
```

대용량 Raw Data는 제외한다.

---

# 7. `.gitignore` 설정

초기에 반드시 설정한다.

예:

```gitignore
# Raw sequencing
*.fastq
*.fastq.gz
*.fq
*.fq.gz
*.bam
*.cram

# Large/local data directories
raw-data/
local-data/
instrument-data/

# OS
.DS_Store
Thumbs.db

# Optional Obsidian local state
.obsidian/workspace.json
.obsidian/workspace-mobile.json
```

`.obsidian` 전체를 무조건 제외하지 않는다.

팀이 공유해야 하는 설정과 개인 설정을 구분한다.

---

# 8. Obsidian Git 설정

목표:

```text
Obsidian
   ↓
commit
   ↓
push
```

연구자가 Git 명령을 매번 직접 입력하지 않아도 되게 한다.

처음에는 지나치게 짧은 자동 commit 주기를 피한다.

예를 들어 사용 패턴을 보면서:

```text
manual push
또는
수십 분 단위 자동 backup
```

부터 시작한다.

---

# 9. Phase 1 성공 조건

다음이 안정적으로 되면 Phase 1 완료다.

```text
[ ] Obsidian에서 노트 작성
[ ] Git commit 가능
[ ] GitHub push 가능
[ ] 다른 PC에서 pull 가능
[ ] Obsidian 링크 유지
[ ] 불필요한 파일이 Git에 들어오지 않음
```

---

# 10. Phase 2 — Experiment ID 도입

다음으로 모든 주요 실험에 ID를 붙인다.

예:

```text
EXP-001
EXP-002
EXP-003
```

파일명:

```text
EXP-001_Golden-Gate-temperature.md
```

Frontmatter:

```yaml
---
type: experiment
id: EXP-001
status: planned
---
```

---

# 11. 처음부터 모든 옛 노트에 ID를 붙이지 않는다

기존 수백 개 노트를 한 번에 수정할 필요는 없다.

권장:

```text
기존 노트
→ 그대로 유지

새로운 주요 실험
→ EXP-ID 사용

필요한 기존 실험
→ 나중에 점진적으로 ID 부여
```

이 방식이 훨씬 현실적이다.

---

# 12. 최소 Frontmatter

초기 필수:

```yaml
---
type: experiment
id: EXP-001
status: in-progress
---
```

권장 추가:

```yaml
project: PRJ-LYCOPENE
date: 2026-09-10
```

처음부터 많은 metadata를 요구하지 않는다.

---

# 13. Experiment Template

`90_Templates/Experiment.md`

예:

```markdown
---
type: experiment
id:
project:
status: planned
date:
---

# Experiment

## Objective

## Hypothesis

## Experimental Design

## Protocol

## Execution

## Observations

## Results

## Interpretation

## Problems / Unexpected Events

## Next Steps

## Related

## Data
```

모든 section을 반드시 채울 필요는 없다.

---

# 14. Status vocabulary 고정

초기에는 다음 정도면 충분하다.

```text
planned
in-progress
needs-review
completed
failed
discontinued
needs-repeat
```

팀 전체가 같은 단어를 사용한다.

---

# 15. Phase 3 — 대용량 파일 보호

이 단계는 비교적 일찍 적용하는 것이 좋다.

구조:

```text
.gitignore
    +
pre-commit
    +
GitHub Action
```

---

# 16. Pre-commit

예시 정책:

```text
< 10 MB
→ 허용

10–50 MB
→ warning

> 50 MB
→ block
```

실제 threshold는 팀 데이터 특성에 맞게 변경한다.

자동으로 파일을 이동하지는 않는다.

---

# 17. 데이터 저장 구조

처음에는 NAS나 기존 연구 스토리지에:

```text
Research-Data/
└── PRJ-LYCOPENE/
    ├── EXP-001/
    │   ├── raw/
    │   ├── processed/
    │   └── analysis/
    └── EXP-002/
```

정도만 만들어도 충분하다.

---

# 18. Research Note에서 데이터 연결

초기:

```yaml
data_path: PRJ-LYCOPENE/EXP-001/
```

정도로 시작한다.

나중에:

```text
Dataset ID
Manifest
Checksum
URI
```

를 추가한다.

---

# 19. Phase 4 — GitHub Issues

Git/GitHub 흐름이 안정된 뒤 Issue 자동화를 추가한다.

기본 원칙:

```text
One major Experiment
        ↕
One GitHub Issue
```

Issue는 연구노트의 복사본이 아니다.

---

# 20. Label 생성

초기 Label:

```text
experiment

status:planned
status:in-progress
status:needs-review
status:completed
status:failed
status:discontinued
status:needs-repeat
```

처음에는 이것만으로 충분하다.

---

# 21. Issue 수동 운영을 먼저 시험

자동 생성 전에 1~2주 정도 수동으로 실험해 보는 것도 좋다.

예:

```text
[EXP-025] Insert ratio test
```

Issue를 직접 만들고 팀이 실제로 댓글을 사용하는지 확인한다.

왜냐하면 자동화를 만들기 전에 **운영 방식이 유용한지 검증**하는 것이 더 중요하기 때문이다.

---

# 22. Issue에서 확인할 것

실제 사용 후 다음을 평가한다.

```text
회의에서 유용한가?
댓글이 실제로 남는가?
Issue가 너무 많이 생기지 않는가?
한 Experiment = 한 Issue가 적절한가?
status Label이 유용한가?
```

그 결과에 따라 자동화를 만든다.

---

# 23. Phase 5 — GitHub Actions MVP

그 다음 자동화를 추가한다.

첫 Workflow:

```text
validate.yml
```

역할:

```text
Markdown 검사
Frontmatter 검사
EXP-ID 검사
중복 ID 검사
대용량 파일 검사
```

---

# 24. 두 번째 Workflow

```text
experiment-issues.yml
```

역할:

```text
push
 ↓
변경된 Experiment 탐지
 ↓
EXP-ID 확인
 ↓
기존 Issue 검색
 ↓
없으면 Issue 생성
 ↓
status Label 적용
```

---

# 25. Action은 원본 노트를 수정하지 않는다

초기 원칙:

```text
GitHub Action
    X
EXP-001.md 자동 수정
```

대신:

```text
GitHub Action
    ↓
Issue / Label / Check 생성
```

만 한다.

이렇게 하면 Obsidian과 GitHub 사이의 conflict가 크게 줄어든다.

---

# 26. Phase 6 — Decision Note

Issue 토론이 실제로 사용되기 시작하면 중요한 결론을 Decision Note로 승격한다.

예:

```text
04_Decisions/
DEC-001-use-condition-B.md
```

흐름:

```text
Issue Discussion
      ↓
Important Decision
      ↓
Decision Note
      ↓
Git history
```

모든 댓글을 Markdown으로 복사하지 않는다.

---

# 27. Phase 7 — Wiki MVP

Wiki는 처음부터 논문 전체 구조를 만들 필요가 없다.

처음에는 세 페이지만 만들어도 된다.

```text
Home
Current Findings
Open Questions
```

---

# 28. Current Findings

예:

```markdown
# Current Findings

## Finding 01

Condition B appears to improve assembly efficiency.

Evidence:
- EXP-014
- EXP-018

Confidence:
Preliminary
```

이것만으로도 Living Manuscript가 시작된다.

---

# 29. Wiki 사용이 자리 잡으면 확장

그 다음:

```text
Research Overview
Background
Methods
Results
Discussion
Limitations
Future Work
Evidence Index
References
```

로 확장한다.

---

# 30. Phase 8 — AI MVP

Git/Issues/Wiki가 안정된 후 AI를 붙인다.

처음부터 Agent를 만들지 않는다.

첫 AI 기능은 다음 세 가지를 추천한다.

```text
1. Experiment Summary
2. Issue Discussion Summary
3. Wiki Update Proposal
```

---

# 31. AI는 Label 기반으로 시작

예:

```text
ai-review
```

Label을 붙이면 AI가 실행된다.

장점:

```text
비용 통제
원하지 않는 AI 호출 방지
테스트 쉬움
사람이 실행 시점 결정
```

---

# 32. AI 출력 위치

초기에는 GitHub Issue 댓글이 가장 단순하다.

예:

```text
AI Summary
AI Decision Candidate
AI Wiki Proposal
```

별도 파일을 자동 생성하지 않아도 된다.

---

# 33. AI 자동화가 안정되면

그 다음:

```text
Decision Note draft
Weekly Digest
Related Experiment Search
Unresolved Questions
```

를 추가한다.

---

# 34. Phase 9 — Data Manifest

데이터가 많아지기 시작하면:

```text
manifests/
├── EXP-001.yaml
├── EXP-002.yaml
└── EXP-003.yaml
```

를 도입한다.

예:

```yaml
experiment: EXP-001
storage: PRJ-LYCOPENE/EXP-001/

datasets:
  - id: DATA-0001
    role: raw
    format: fastq.gz
```

---

# 35. Phase 10 — RAG

노트와 Issue가 충분히 쌓인 뒤 RAG가 의미를 갖는다.

검색 대상:

```text
Experiment Notes
Decision Notes
Protocols
Issue summaries
Wiki Findings
```

사용 예:

```text
"condition B와 관련된 모든 실험을 찾아줘."

"현재 해결되지 않은 질문은?"

"Finding 03을 지지하는 근거는?"
```

---

# 36. Phase 11 — Local LLM

보안 또는 비용 때문에 필요해지면 Local LLM을 연결한다.

중요한 것은 앞에서 AI Provider abstraction을 만들어 두는 것이다.

```text
AI Interface
    │
    ├─ Cloud Provider
    └─ Local Provider
```

그래야 기존 workflow를 크게 바꾸지 않는다.

---

# 37. Phase 12 — Research Agent

가장 마지막 단계다.

Agent가:

```text
Search Notes
Search Issues
Read Wiki
Query Data Catalog
Search Decisions
```

등의 tool을 사용할 수 있다.

초기 권한은 read-only로 한다.

---

# 38. MCP 확장

향후 MCP와 같은 tool interface를 이용하면:

```text
Research Agent
    │
    ├─ Notes Tool
    ├─ GitHub Tool
    ├─ Data Catalog Tool
    ├─ Analysis Tool
    └─ Instrument Tool
```

로 발전시킬 수 있다.

이 단계는 현재의 연구노트 시스템이 Software-Defined Biofoundry나 Co-Scientist 계층으로 확장되는 지점이기도 하다.

---

# 39. 추천 1주차

### Day 1

```text
현재 Vault 점검
Git 상태 점검
대용량 파일 점검
```

### Day 2

```text
.gitignore 정리
GitHub private repository 확인
Obsidian Git 설정
```

### Day 3

```text
Experiment Template
EXP-ID 규칙
status 규칙
```

### Day 4

```text
pre-commit large-file check
```

### Day 5

```text
실제 연구노트 2~3개로 사용
문제점 기록
```

---

# 40. 추천 2주차

```text
GitHub Labels 생성
Experiment Issue 몇 개 수동 생성
회의에서 실제 사용
```

목표는 자동화 구현이 아니라 Issue workflow 검증이다.

---

# 41. 추천 3주차

```text
validate.yml
EXP-ID validation
status validation
large-file validation
```

을 구현한다.

---

# 42. 추천 4주차

```text
experiment-issues.yml
신규 Experiment Issue 생성
status Label 동기화
```

를 구현한다.

---

# 43. 2개월차

운영 데이터가 쌓이면:

```text
Decision Note
Wiki Current Findings
Open Questions
Evidence links
```

를 본격적으로 사용한다.

---

# 44. 3개월차 이후

필요성이 확인되면:

```text
AI summary
Wiki proposal
Weekly digest
Data Manifest
RAG
```

순으로 확장한다.

---

# 45. 처음부터 하지 않는 것이 좋은 것

다음은 매력적으로 보이지만 초기에는 미루는 것이 좋다.

```text
완전 자동 Wiki 작성
AI가 status 자동 변경
AI가 실험 성공/실패 판정
모든 노트에 복잡한 ontology 강제
수십 개 Frontmatter 필드
모든 데이터 checksum 자동화
모든 Issue 댓글 Repository 복제
대용량 파일 자동 NAS 이동
복잡한 GitHub Projects board
완전한 Knowledge Graph
Autonomous Research Agent
```

---

# 46. 운영 복잡도 증가 원칙

새 기능은 다음 질문을 통과할 때만 추가한다.

```text
1. 실제 문제가 존재하는가?
2. 반복적으로 발생하는가?
3. 자동화가 연구자의 작업을 줄이는가?
4. 데이터 중복을 만들지 않는가?
5. SSOT를 흐리지 않는가?
6. 오류가 발생해도 연구 기록이 손상되지 않는가?
```

하나라도 명확하지 않으면 일단 수동으로 운영한다.

---

# 47. 시스템 성공 지표

기술 기능 수보다 실제 사용성을 측정한다.

예:

### 연구 기록

```text
Experiment 중 노트가 존재하는 비율
EXP-ID 중복 발생 횟수
```

### 협업

```text
Issue 사용률
needs-review 처리 시간
회의 후 미결 질문 수
```

### 데이터

```text
Git 대용량 파일 차단 횟수
데이터 위치를 찾지 못한 사례
```

### 지식 축적

```text
Finding에 Evidence가 연결된 비율
Decision에 근거가 연결된 비율
```

### AI

```text
AI proposal 승인율
수정 후 승인율
거절률
근거 없는 제안 발생률
```

---

# 48. 가장 중요한 평가지표

시스템의 최종 질문은:

> **이 시스템 때문에 연구자가 기록을 더 많이 해야 하는가, 아니면 원래 하던 기록이 자연스럽게 더 유용해지는가?**

후자가 되어야 한다.

---

# 49. 권장 최종 Repository 구조

시스템이 어느 정도 자리 잡으면 예를 들어:

```text
Research-Vault/
│
├── 00_Inbox/
│
├── 01_Projects/
│   └── Project-A/
│       ├── Project-A.md
│       ├── Experiments/
│       ├── Results/
│       └── Meetings/
│
├── 02_Protocols/
├── 03_Resources/
├── 04_Decisions/
├── 05_Manuscript/
├── 90_Templates/
├── 99_Archive/
│
├── manifests/
│
├── scripts/
│   ├── validate_notes.py
│   ├── check_large_files.py
│   └── changed_experiments.py
│
├── ai/
│   ├── providers/
│   ├── prompts/
│   └── schemas/
│
├── .github/
│   ├── workflows/
│   │   ├── validate.yml
│   │   ├── experiment-issues.yml
│   │   └── ai-assistant.yml
│   └── ISSUE_TEMPLATE/
│
├── .githooks/
│   └── pre-commit
│
├── .obsidian/
├── .gitignore
└── README.md
```

그러나 이것은 **최종적인 예시 구조**이지 처음부터 강제할 구조는 아니다.

---

# 50. 전체 구축 단계 요약

```text
Phase 0
현재 Vault 점검
     ↓
Phase 1
Obsidian + Git + GitHub
     ↓
Phase 2
EXP-ID + minimal Frontmatter
     ↓
Phase 3
Large-file protection + Data Storage
     ↓
Phase 4
GitHub Issues
     ↓
Phase 5
GitHub Actions
     ↓
Phase 6
Decision Notes
     ↓
Phase 7
Living Manuscript Wiki
     ↓
Phase 8
AI MVP
     ↓
Phase 9
Data Manifest
     ↓
Phase 10
RAG
     ↓
Phase 11
Local LLM
     ↓
Phase 12
Research Agent / MCP
```

---

# 51. 01~08 문서의 관계

```text
01_overall-research-note-architecture.md
        │
        ├─ 전체 철학과 구조
        │
02_obsidian-research-notes.md
        │
        ├─ 연구자의 작업 공간
        │
03_github-issues.md
        │
        ├─ 협업과 실험 lifecycle
        │
04_living-manuscript-wiki.md
        │
        ├─ 지식 축적과 논문화
        │
05_github-actions.md
        │
        ├─ 기계적 자동화
        │
06_ai-automation.md
        │
        ├─ AI 보조 계층
        │
07_large-data-management.md
        │
        ├─ 연구 데이터 실체 관리
        │
08_implementation-roadmap.md
        │
        └─ 실제 구축 순서
```

---

# 52. 시스템 전체의 SSOT

SSOT를 하나의 파일로 생각하기보다는 **정보 종류별 authority**를 명확히 한다.

```text
실험 기록
→ Obsidian/Git Research Note

실험 데이터
→ Research Data Storage

협업 토론
→ GitHub Issue

중요한 의사결정
→ Decision Note

현재의 통합 지식
→ Wiki Finding

분석 코드
→ Git Repository
```

각 정보는 한 곳에서 authoritative하게 관리하고 다른 곳에서는 링크한다.

---

# 53. 최종 연구 흐름

```text
Research Question
       │
       ▼
   Hypothesis
       │
       ▼
   Experiment
       │
       ├──────────────▶ Raw Data
       │                    │
       ▼                    ▼
Research Note          Data Storage
       │                    │
       └────────┬───────────┘
                ▼
            Git / GitHub
                │
                ▼
              Issue
                │
          Collaboration
                │
        ┌───────┴────────┐
        ▼                ▼
    Decision          Next Experiment
        │
        ▼
      Finding
        │
        ▼
       Wiki
        │
   Living Manuscript
        │
        ▼
      Figure
        │
        ▼
       Paper
```

AI는 이 전체 과정의 옆에서:

```text
검색
요약
연결
검토
제안
```

을 돕는다.

---

# 54. 최종 원칙

> **Obsidian에서 연구하고, Git에서 기록을 보존하고, Issues에서 함께 논의하고, 별도 Storage에서 데이터를 관리하며, Wiki에서 지식을 축적하고, AI가 그 사이의 연결과 정리를 돕도록 한다.**

가장 중요한 것은 기술 자체가 아니다.

**연구자가 기존 방식에서 크게 벗어나지 않고 기록을 남겼는데, 그 기록이 자연스럽게 협업·데이터 provenance·지식 축적·논문 작성·AI 활용으로 이어지는 시스템**을 만드는 것이 목표다.
