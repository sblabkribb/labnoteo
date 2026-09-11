# 06. AI 자동화 계층 설계

> **목표:** AI를 연구자의 판단을 대체하는 시스템이 아니라, 연구 기록을 정리하고 연결하고 검토 후보를 만들어주는 **보조 계층**으로 설계한다.

---

## 1. 기본 원칙

AI 계층의 핵심 원칙은 다음과 같다.

1. 연구 원본은 AI가 아니라 사람이 작성한 연구노트다.
2. AI는 원본 연구노트를 자동으로 덮어쓰지 않는다.
3. AI 출력은 기본적으로 **초안, 제안, 요약, 후보**다.
4. 과학적 결론은 사람이 승인한다.
5. AI가 만든 문장에는 가능한 한 근거 ID를 연결한다.
6. AI는 특정 공급자에 종속되지 않도록 교체 가능한 계층으로 만든다.
7. 연구 데이터 보안 수준에 따라 클라우드 AI와 로컬 AI를 분리한다.
8. 자동화가 너무 잦아 연구자에게 noise를 만들지 않도록 한다.

---

## 2. AI는 어디에서 동작할까?

이 시스템에서는 AI가 크게 세 위치에서 동작할 수 있다.

```text
[1] Obsidian 내부 AI
      ↓
개인 작업 보조

[2] GitHub Actions 기반 AI
      ↓
자동 요약 / Issue / Wiki 제안

[3] 별도 AI 서버 또는 Local LLM
      ↓
RAG / 연구 Agent / 민감 데이터 처리
```

각 계층의 역할을 겹치지 않게 하는 것이 좋다.

---

## 3. Obsidian 내부 AI의 역할

Obsidian AI는 연구자가 노트를 작성하는 순간에 가장 가까운 AI다.

권장 역할:

- 문장 다듬기
- 현재 노트 요약
- 관련 노트 찾기
- 기존 실험 검색
- TODO 추출
- 초안 작성
- 회의 메모 정리
- 관련 Hypothesis/Experiment 연결 제안
- 노트 제목/태그 후보 제안

예:

```text
현재 EXP-025 노트를 요약해줘.

이 결과와 관련된 이전 실험을 찾아줘.

이 노트에서 다음 실험 후보를 정리해줘.
```

이 계층은 **개인 생산성**에 집중한다.

---

## 4. Obsidian AI가 하지 말아야 할 일

다음은 기본적으로 자동 실행하지 않는다.

```text
연구노트 자동 수정
status 자동 변경
실험 성공/실패 자동 확정
Decision 자동 승인
Wiki 자동 업데이트
```

AI가 제안할 수는 있다.

예:

```text
Suggested status:
needs-repeat

Reason:
Two replicates show inconsistent transformation efficiency.
```

하지만 실제 Frontmatter 변경은 사람이 승인한다.

---

## 5. GitHub AI의 역할

GitHub 쪽 AI는 개인 작업보다는 **팀 협업과 중앙 자동화**에 적합하다.

예:

```text
Experiment completed
      ↓
Research note + Issue comments
      ↓
AI
      ↓
Summary
Unresolved questions
Decision candidates
Wiki update candidate
```

GitHub Action 또는 별도의 webhook/worker가 이를 실행할 수 있다.

---

## 6. AI 자동화 Trigger

모든 push마다 AI를 호출하지 않는다.

추천 trigger:

### 방법 A — 상태 기반

```yaml
status: completed
```

으로 변경되었을 때.

### 방법 B — Label 기반

Issue에:

```text
ai-review
```

Label이 붙었을 때.

### 방법 C — 수동 실행

GitHub Actions의 manual trigger.

### 방법 D — 일정 기반

예:

```text
매주 금요일
→ 이번 주 완료된 Experiment 요약
```

초기에는 **수동 또는 Label 기반**이 가장 안전하다.

---

## 7. Experiment 요약

AI가 Experiment를 읽고 다음 구조로 요약할 수 있다.

```markdown
## AI Experiment Summary

### Objective

...

### Key Observations

- ...
- ...

### Result

...

### Potential Interpretation

...

### Unresolved Questions

- ...
- ...

### Suggested Follow-up

- ...

### Evidence

- EXP-025
```

이 요약은 Issue 댓글로 남길 수 있다.

---

## 8. 원본과 AI 요약의 관계

중요한 구조:

```text
Research Note
= Original evidence

AI Summary
= Derived interpretation
```

AI 요약은 원본이 아니다.

따라서 나중에 내용이 충돌하면 항상 Research Note가 우선한다.

---

## 9. Issue 댓글 요약

Issue 댓글이 길어지면 AI가 토론을 정리한다.

예:

```markdown
## Discussion Summary

### Main Points

1. Insert ratio may explain the low assembly efficiency.
2. Two members suggested repeating condition B.
3. Condition C produced inconsistent results.

### Agreements

- Repeat condition B.

### Disagreements

- Whether condition C should be discontinued.

### Open Questions

- Is the effect construct-specific?
- Should transformation volume be changed?
```

이 기능은 회의 전 특히 유용하다.

---

## 10. Decision 후보 추출

AI는 다음을 구분해서 제안한다.

```text
Observation
Interpretation
Proposal
Decision candidate
```

예:

```markdown
## Possible Decision

Discontinue condition C.

### Rationale

- EXP-021 showed low efficiency.
- EXP-024 reproduced the same issue.
- Issue discussion indicates consensus toward stopping condition C.

### Supporting Evidence

- EXP-021
- EXP-024

### Human Review

[ ] Accept
[ ] Modify
[ ] Reject
```

사람이 승인하면 Decision Note로 만든다.

---

## 11. Decision Note 자동 초안

사람이 승인한 뒤 AI가 다음 파일의 초안을 만들 수 있다.

```text
04_Decisions/
DEC-003-stop-condition-C.md
```

예:

```markdown
---
type: decision
id: DEC-003
status: proposed
source_issue: 51
---

# DEC-003 Stop condition C

## Decision

Condition C will be discontinued.

## Rationale

...

## Evidence

- [[EXP-021]]
- [[EXP-024]]

## Source Discussion

Issue #51
```

여기서도 자동 merge보다 PR 초안이 더 안전하다.

---

## 12. 다음 실험 후보 생성

AI가 현재 결과와 미해결 질문을 기반으로 후속 실험 후보를 제시할 수 있다.

예:

```markdown
## Suggested Next Experiments

### Option 1 — Repeat condition B

Purpose:
Confirm reproducibility.

Evidence:
EXP-021, EXP-024

Priority:
High

### Option 2 — Test condition D

Purpose:
Evaluate an alternative reaction condition.

Priority:
Medium
```

AI가 Experiment ID를 직접 확정해 생성하기보다 사람이 선택한 뒤 새 Experiment Note를 만드는 것이 좋다.

---

## 13. Wiki Update Proposal

AI 계층에서 가장 중요한 기능 중 하나다.

예:

```markdown
## Proposed Wiki Update

### Target

Results → Finding 01

### New Evidence

EXP-025

### Current Statement

Condition B appears to improve assembly efficiency.

### Suggested Revision

Condition B showed higher assembly efficiency in three
independent experiments.

### Supporting Evidence

- EXP-014
- EXP-018
- EXP-025

### Contradicting Evidence

- EXP-017

### Suggested Confidence

Moderate

### Action

[ ] Accept
[ ] Modify
[ ] Reject
```

Wiki를 AI가 바로 수정하지 않고 이러한 Proposal을 만든다.

---

## 14. AI가 근거 없는 문장을 만들지 않게 하는 방법

AI prompt에 다음 원칙을 넣는다.

```text
1. Use only the supplied research notes and issue comments.
2. Every scientific claim must reference one or more evidence IDs.
3. If evidence is insufficient, state "insufficient evidence".
4. Do not infer unrecorded experimental conditions.
5. Separate observation from interpretation.
6. Clearly identify contradictions.
```

이 규칙은 매우 중요하다.

---

## 15. Evidence-aware 출력

좋은 AI 출력:

```text
Condition B showed higher assembly efficiency
in EXP-014, EXP-018, and EXP-025.
```

좋지 않은 출력:

```text
Condition B is clearly the optimal condition.
```

왜냐하면 두 번째 문장은 근거 수준보다 강한 주장일 수 있기 때문이다.

---

## 16. AI 출력 schema

AI 출력은 자유로운 prose보다 구조화된 schema가 좋다.

예:

```json
{
  "summary": "...",
  "observations": [],
  "interpretations": [],
  "unresolved_questions": [],
  "decision_candidates": [],
  "follow_up_experiments": [],
  "wiki_update": {
    "target": "",
    "suggested_text": "",
    "evidence": []
  }
}
```

그 뒤 GitHub Action이나 별도 프로그램이 이를 Markdown으로 렌더링할 수 있다.

---

## 17. 왜 JSON/구조화 출력이 좋은가?

AI 모델을 바꾸더라도 downstream 자동화가 유지되기 때문이다.

```text
LLM A
   │
   ▼
Common JSON Schema
   │
   ├─ Issue renderer
   ├─ Wiki proposal
   ├─ Dashboard
   └─ RAG index

LLM B
   │
   └──── same schema
```

이것이 AI vendor lock-in을 줄이는 핵심이다.

---

## 18. AI Provider abstraction

코드 구조를 다음처럼 만든다.

```text
ai/
├── provider.py
├── openai_provider.py
├── local_provider.py
└── prompts/
```

예:

```text
summarize_experiment(note)
summarize_issue(comments)
propose_decision(context)
propose_wiki_update(context)
```

호출 인터페이스는 동일하게 유지한다.

---

## 19. 클라우드 AI와 로컬 LLM

### 클라우드 AI

장점:

- 구현이 빠름
- 모델 성능이 좋음
- 운영이 쉬움

단점:

- 데이터 외부 전송 가능성
- 비용
- API 의존성

### Local LLM

장점:

- 내부 데이터 보호
- 네트워크 독립성
- 자체 fine-tuning 가능
- 장기적인 비용 통제

단점:

- GPU 필요
- 운영 복잡성
- 모델 관리 필요

초기 MVP는 클라우드 AI로 시작하고, 인터페이스를 분리해 향후 로컬 모델로 교체하는 방법이 현실적이다.

---

## 20. 데이터 보안 등급

모든 노트를 같은 AI로 보내지 않는 구조도 가능하다.

예:

```yaml
ai_access: cloud
```

또는:

```yaml
ai_access: local-only
```

또는:

```yaml
ai_access: disabled
```

예:

```yaml
---
type: experiment
id: EXP-025
ai_access: local-only
---
```

자동화가 이 값을 확인한다.

---

## 21. AI에 보내면 안 되는 데이터

연구기관 정책에 따라 다르지만 최소한 다음을 별도로 검토해야 한다.

- 개인정보
- 계약상 비공개 데이터
- 특허 출원 전 민감 정보
- 외부 반출 금지 데이터
- 원시 임상 데이터
- 보안 등급이 지정된 데이터
- 협력기관이 제공한 제한 데이터

AI 자동화 전에 데이터 분류 정책을 정하는 것이 좋다.

---

## 22. Raw Data를 LLM에 직접 보내지 않는다

FASTQ, 대형 이미지, 장비 raw output 전체를 일반 LLM workflow로 보내는 것은 비효율적이다.

대신:

```text
Raw Data
   ↓
Analysis pipeline
   ↓
Structured result
   ↓
Research Note
   ↓
AI
```

를 기본으로 한다.

AI는 분석된 결과와 연구 맥락을 읽는다.

---

## 23. RAG의 필요성

프로젝트가 커지면 하나의 prompt에 모든 연구노트를 넣을 수 없다.

이때 RAG를 사용한다.

예:

```text
User question
"condition B 관련 실험은?"
       ↓
Retriever
       ↓
EXP-014
EXP-018
EXP-025
Issue #43
DEC-003
       ↓
LLM
       ↓
Answer + Evidence IDs
```

---

## 24. RAG index 대상

초기에는 다음을 index하면 충분하다.

```text
Experiment Notes
Hypothesis Notes
Result Notes
Decision Notes
Protocols
Issue summaries
Wiki Findings
```

Raw binary data는 index 대상이 아니다.

---

## 25. Metadata-aware RAG

단순한 semantic search보다 metadata filter를 함께 쓰면 좋다.

예:

```text
project = PRJ-LYCOPENE
type = experiment
status = completed
```

그 뒤 semantic search를 수행한다.

이렇게 하면 다른 프로젝트의 유사한 실험이 섞이는 문제를 줄일 수 있다.

---

## 26. AI에게 Obsidian 링크를 이해시키기

예:

```markdown
[[EXP-014]]
[[Golden Gate Assembly Protocol]]
[[DEC-003]]
```

이 링크를 parser가 실제 파일 ID로 resolve한다.

그 뒤 AI context에서는:

```text
Related experiment: EXP-014
Related protocol: Golden Gate Assembly Protocol
Related decision: DEC-003
```

처럼 제공한다.

---

## 27. Graph + RAG

장기적으로는 Obsidian link graph 자체가 중요한 검색 정보가 된다.

예:

```text
EXP-025
 ├─ HYP-002
 ├─ Protocol-GG
 ├─ RES-004
 └─ DEC-003
```

AI가 semantic similarity뿐 아니라 graph neighbor도 함께 조회하면 훨씬 좋은 context를 만들 수 있다.

---

## 28. AI Research Assistant

고도화되면 AI에게 다음과 같은 질문이 가능하다.

```text
"현재 lycopene 프로젝트에서 해결되지 않은 질문을 정리해줘."

"assembly efficiency에 반하는 결과가 있었나?"

"Figure 2를 지지하는 실험들을 보여줘."

"최근 2주 동안 새로 생긴 결론은 뭐야?"

"중단한 실험과 그 이유를 알려줘."
```

이때 반드시 관련 Evidence ID를 반환하도록 한다.

---

## 29. Research Agent로 확장

RAG 다음 단계에서는 AI Agent가 여러 tool을 사용할 수 있다.

예:

```text
Question
   ↓
Agent
   ├─ Search notes
   ├─ Search Issues
   ├─ Read Wiki
   ├─ Query experiment metadata
   └─ Query data catalog
   ↓
Answer
```

향후 MCP 같은 tool interface를 붙이면 확장하기 쉽다.

---

## 30. AI Agent에게 write 권한을 바로 주지 않는다

처음에는:

```text
read-only
```

로 시작한다.

이후:

```text
create proposal
create draft Issue
create draft PR
```

정도까지 허용한다.

최종적으로도 다음 작업은 사람 승인 방식이 좋다.

```text
Wiki update
Decision approval
Experiment status change
data deletion
```

---

## 31. Human-in-the-loop

권장 패턴:

```text
AI detects
   ↓
AI proposes
   ↓
Human reviews
   ↓
Human accepts
   ↓
Automation applies
```

좋지 않은 패턴:

```text
AI detects
   ↓
AI decides
   ↓
AI modifies scientific record
```

---

## 32. AI 결과 신뢰 수준

AI 출력에도 status를 둘 수 있다.

예:

```text
draft
reviewed
accepted
rejected
```

예:

```yaml
ai_status: draft
```

이는 과학적 confidence와는 다른 개념이다.

---

## 33. 자동화 비용 관리

모든 변경에 AI를 호출하지 않는다.

예를 들어 다음 경우만 호출한다.

```text
status: completed
status: failed
Issue label: ai-review
weekly summary
manual request
```

또한 긴 노트는 먼저 deterministic parser로 필요한 부분만 추출한다.

---

## 34. Prompt version 관리

Prompt도 연구 인프라 코드다.

따라서 Git에서 관리한다.

예:

```text
ai/prompts/
├── experiment-summary-v1.md
├── decision-proposal-v1.md
└── wiki-update-v1.md
```

모델이 이상한 출력을 냈을 때 어떤 prompt를 사용했는지 추적 가능하다.

---

## 35. AI 실행 기록

AI 결과에는 가능하면 다음 metadata를 남긴다.

```text
model
prompt version
timestamp
source experiment IDs
source issue
```

예:

```markdown
AI metadata:
- Prompt: wiki-update-v1
- Sources: EXP-014, EXP-018, EXP-025
```

API key나 민감한 내부 설정은 기록하지 않는다.

---

## 36. AI와 논문 작성

AI가 Living Manuscript에서 논문 초안을 만들 수 있다.

그러나 순서는:

```text
Evidence
   ↓
Wiki Findings
   ↓
Human-reviewed interpretation
   ↓
AI manuscript draft
```

여야 한다.

Raw notes → AI → final paper

처럼 바로 넘어가지 않는 것이 좋다.

---

## 37. Citation-ready Evidence

논문 작성 단계에서는 내부 Evidence와 외부 문헌을 구분한다.

```text
Internal Evidence
EXP-014
EXP-018

External Evidence
DOI / PMID / reference
```

AI에게 이 둘을 섞지 않도록 명시한다.

---

## 38. 회의 지원 AI

회의 전:

```text
AI:
- active experiments
- needs-review Issues
- unresolved questions
- decisions pending
- experiments completed since last meeting
```

을 요약할 수 있다.

회의 후:

```text
meeting note
   ↓
AI
   ↓
related Issue suggestions
decision candidates
action items
```

을 생성할 수 있다.

---

## 39. 주간 Research Digest

향후 유용한 자동화다.

예:

```markdown
# Weekly Research Digest

## Completed Experiments

- EXP-025
- EXP-026

## Failed / Discontinued

- EXP-022

## New Findings

- Finding 03 updated

## Open Decisions

- DEC candidate from Issue #51

## Next Experiments

- EXP-031
- EXP-032

## Major Open Questions

...
```

팀 전체 연구 진행을 파악하는 데 좋다.

---

## 40. 최소 AI MVP

처음에는 다음 세 가지만 추천한다.

### 1.

Experiment 완료 시 AI 요약

### 2.

Issue 댓글 요약

### 3.

Wiki Update Proposal

Decision 자동화와 Next Experiment Agent는 그 다음 단계로 미룬다.

---

## 41. 2단계 AI

MVP가 안정되면:

```text
Decision candidate
Weekly digest
Related experiment retrieval
Open question extraction
```

을 추가한다.

---

## 42. 3단계 AI

장기적으로:

```text
RAG
Graph-aware retrieval
Local LLM
MCP tools
Research Agent
Automated manuscript draft
Experimental planning assistant
```

로 확장할 수 있다.

---

## 43. 권장 전체 AI 아키텍처

```text
                     Obsidian
                        │
                 Research Notes
                        │
                        ▼
                 Git Repository
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
    GitHub Issues                  Wiki
          │                           │
          └─────────────┬─────────────┘
                        ▼
                 AI Context Builder
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
             RAG               Metadata
              │                   │
              └─────────┬─────────┘
                        ▼
                 AI Provider Layer
              ┌─────────┴─────────┐
              ▼                   ▼
          Cloud LLM            Local LLM
              │                   │
              └─────────┬─────────┘
                        ▼
                  Structured Output
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
 Issue Summary    Decision Proposal   Wiki Proposal
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                   Human Review
                        │
                        ▼
               Accepted Knowledge
```

---

## 44. 가장 중요한 설계 원칙

이 시스템에서 AI는 **기록의 소유자(authority)**가 아니다.

권한의 우선순위는:

```text
Raw Data
   ↓
Research Note
   ↓
Human Interpretation
   ↓
Accepted Decision
   ↓
Wiki Finding
   ↓
AI-generated synthesis
```

이다.

AI는 이 구조를 빠르게 탐색하고 정리하고 연결하는 역할을 맡는다.

---

## 45. 한 문장으로 정리

> **AI는 연구 결과를 결정하는 시스템이 아니라, 연구 기록을 근거 중심으로 정리하고 다음 검토 지점을 제안하는 연구 보조 계층으로 사용한다.**

---

## 46. 다음 문서

다음 문서는:

`07_large-data-management.md`

에서 대용량 연구 데이터 관리 구조를 상세하게 설계한다.

주요 내용:

- Git과 연구 데이터의 분리
- NAS / Object Storage / S3-compatible storage 비교
- Experiment ID 기반 데이터 폴더
- Raw / Processed / Result 데이터 구조
- Obsidian에서 데이터 참조 방식
- 경로 대신 URI/ID 사용
- pre-commit 대용량 파일 차단
- Git LFS를 어디까지 사용할지
- 데이터 checksum
- 데이터 provenance
- 데이터 이동/백업
- 로컬 PC와 모바일 환경
- 향후 데이터 catalog 및 AI/RAG 연결

