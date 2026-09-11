# 03. GitHub Issues 기반 연구 협업 설계

> **목표:** 연구노트의 원본은 Obsidian/Git Repository에 유지하면서, GitHub Issues를 실험별 토론·진행 관리·의사결정·회의 협업 공간으로 사용한다.

---

## 1. 기본 개념

이 시스템에서 세 요소의 역할을 명확히 분리한다.

```text
Obsidian Research Note
= 무엇을 했는가?
= 실험 기록 / 관찰 / 결과 / 해석의 원본

GitHub Issue
= 이 실험에 대해 무엇을 논의하고 있는가?
= 질문 / 의견 / 리뷰 / 후속 작업 / 진행 상태

GitHub Wiki
= 지금까지 무엇을 알게 되었는가?
= 여러 실험을 종합한 현재의 지식
```

따라서 Issue에 연구노트 전체를 복사하지 않는다.

**Research Note가 SSOT이고 Issue는 그 노트를 둘러싼 협업 레이어**다.

---

## 2. 기본 단위: Experiment ↔ Issue

기본적으로 하나의 주요 실험 노트에 하나의 Issue를 연결한다.

```text
EXP-001.md
    │
    ├─────────────▶ GitHub Issue #37
    │                    │
    │                    ├─ 의견
    │                    ├─ 질문
    │                    ├─ 리뷰
    │                    ├─ 후속 작업
    │                    └─ 결정 후보
    │
    └─────────────▶ Raw Data
```

단, 모든 작은 메모에 Issue를 만들 필요는 없다.

Issue 자동 생성 대상은 예를 들어 다음 조건으로 제한할 수 있다.

```yaml
---
type: experiment
id: EXP-001
collaboration: true
---
```

또는 `type: experiment`인 노트만 자동으로 생성하도록 할 수 있다.

---

## 3. Issue 본문에는 무엇을 넣을까?

연구노트 전체를 복사하지 않고 최소한의 context만 제공한다.

예:

```markdown
# EXP-001 — Golden Gate temperature test

## Research Note

[EXP-001 Research Note](...)

## Objective

Compare assembly efficiency under different reaction conditions.

## Status

In progress

## Data

Research data: EXP-001

---

## Discussion

Please use the comments below for:

- questions
- experimental suggestions
- interpretation
- troubleshooting
- follow-up experiments
```

`Objective` 정도는 Frontmatter 또는 연구노트에서 자동 추출할 수 있다.

---

## 4. Issue 제목 규칙

일관된 제목을 사용하면 검색과 자동화가 쉬워진다.

권장:

```text
[EXP-001] Golden Gate temperature test
[EXP-002] Transformation volume comparison
[EXP-003] Plasmid preparation test
```

따라서 GitHub에서 `EXP-001`만 검색해도 관련 Issue를 찾을 수 있다.

---

## 5. Labels

Issue를 연구 관리 시스템으로 활용하려면 Label이 중요하다.

그러나 너무 많은 Label을 만들면 오히려 사용하기 어렵다.

### Type

```text
experiment
analysis
protocol
decision
question
```

### Status

```text
status:planned
status:in-progress
status:needs-review
status:completed
status:failed
status:discontinued
status:needs-repeat
```

### 선택적 Priority

필요한 경우만:

```text
priority:high
priority:normal
priority:low
```

초기에는 **type + status** 정도로 시작하는 것을 권장한다.

---

## 6. Obsidian 상태와 Issue 상태

Obsidian Frontmatter:

```yaml
status: in-progress
```

GitHub:

```text
status:in-progress
```

두 값은 가능하면 같은 vocabulary를 사용한다.

장기적으로 Action을 이용하여 동기화할 수 있다.

```text
EXP-001.md

status: completed
       │
       │ push
       ▼
GitHub Action
       │
       ▼
Issue Label
status:completed
```

하지만 초기 MVP에서는 자동 동기화를 반드시 구현할 필요는 없다.

---

## 7. Open / Closed와 연구 상태는 분리한다

GitHub의 `Open/Closed`만으로 실험 상태를 표현하지 않는 것이 좋다.

예를 들어 실패한 실험도 중요한 토론이 남아 있을 수 있다.

따라서:

```text
Issue state
Open / Closed

Research status
planned / in-progress / completed / failed / discontinued
```

를 별개로 본다.

예:

```text
status:failed
Issue: Open
```

실패 원인을 계속 논의하는 상황이 가능하다.

토론이 끝난 뒤 Issue를 Close한다.

---

## 8. Issue 댓글의 역할

Issue 댓글에는 연구노트 자체보다 **대화와 reasoning**을 남긴다.

좋은 댓글 예:

```text
The low efficiency may be related to the insert ratio.

Could we repeat this experiment using 1:2 and 1:3 ratios?
```

또는:

```text
The result appears consistent with EXP-014.

I suggest testing the same condition with the second construct.
```

Issue가 다음 질문에 답하도록 만든다.

> 왜 다음 실험을 하게 되었는가?

이 정보는 나중에 논문의 Discussion을 작성할 때 매우 가치가 있다.

---

## 9. 댓글을 모두 Repository로 복사하지 않는다

Issue 자체가 GitHub에 기록되므로 모든 댓글을 다시 Markdown으로 저장하면 중복이 생긴다.

따라서:

```text
Issue comments
     │
     ├─ 일반적인 토론 → GitHub에 그대로 유지
     │
     └─ 중요한 결정
             ↓
        Decision Note
```

라는 구조를 권장한다.

---

## 10. Decision Note로 승격

예를 들어 Issue #51에서 다음 결론이 나왔다고 하자.

```text
Condition C should be discontinued.
Condition B will be used for subsequent experiments.
```

이 결정이 연구 방향에 영향을 준다면:

```text
04_Decisions/
└── DEC-003-stop-condition-C.md
```

를 만든다.

```markdown
---
type: decision
id: DEC-003
status: accepted
source_issue: 51
---

# DEC-003 Stop condition C

## Decision

Condition C will be discontinued.

## Rationale

Repeated low assembly efficiency.

## Evidence

- [[EXP-021]]
- [[EXP-024]]

## Source Discussion

GitHub Issue #51

## Consequence

Future experiments will focus on conditions B and D.
```

---

## 11. AI를 이용한 Decision 후보 추출

Issue 댓글이 길어지면 사람이 매번 전체를 읽고 정리하기 어렵다.

AI가 다음과 같이 정리할 수 있다.

```text
Discussion Summary

1. Condition C repeatedly showed low efficiency.
2. Two members suggested discontinuing condition C.
3. Condition B produced the most consistent result.

Possible Decision

Discontinue condition C and continue with B.

Unresolved Question

Should condition D be repeated?
```

중요한 점:

**AI가 Decision을 확정하지 않는다.**

AI는 후보를 만들고 사람이 승인한다.

---

## 12. 후속 실험 연결

Issue 토론에서 새로운 실험이 제안될 수 있다.

예:

```text
EXP-001
   │
   │ Issue #37
   │
   └── "Let's test 1:3 insert ratio."
                 │
                 ▼
              EXP-004
```

새 연구노트에서는:

```markdown
## Origin

Follow-up experiment from [[EXP-001]]

GitHub Issue #37
```

처럼 provenance를 남길 수 있다.

결국:

```text
Hypothesis
    ↓
EXP-001
    ↓
Issue #37
    ↓
new question
    ↓
EXP-004
```

라는 연구 reasoning chain이 형성된다.

---

## 13. 회의에서 Issues 활용

GitHub Issues는 연구 회의의 agenda로도 사용할 수 있다.

예를 들어 Label로:

```text
status:needs-review
```

인 Issue만 필터링한다.

회의 화면:

```text
Needs Review

#37 EXP-001 Golden Gate temperature
#41 EXP-004 Insert ratio
#52 EXP-011 Transformation
```

각 Issue를 열어:

- 연구노트 확인
- 결과 확인
- 댓글 확인
- 질문 논의
- 다음 작업 결정

을 진행한다.

따로 회의용 PowerPoint를 매번 만들 필요가 줄어든다.

---

## 14. 회의 결과 기록

회의 내용을 별도 문서로 길게 작성하기보다 관련 Issue에 핵심 내용을 댓글로 남길 수 있다.

예:

```markdown
### Meeting update — 2026-09-10

Decision:
- Repeat condition B.
- Stop condition C.

Next:
- @user1: prepare DNA
- @user2: repeat transformation

Related:
- EXP-004
```

중요한 결정은 이후 Decision Note로 승격한다.

---

## 15. Assignee

Issue의 Assignee를 이용하면 실험 책임자를 표시할 수 있다.

```text
EXP-001
Assignee: Researcher A

EXP-002
Assignee: Researcher B
```

연구노트에 담당자를 다시 입력할 필요가 있는지는 운영하면서 결정한다.

SSOT를 엄격히 유지하려면 책임자 정보의 기준 위치도 하나로 정하는 것이 좋다.

---

## 16. Milestone

Milestone은 개별 실험보다 연구 단계 관리에 유용하다.

예:

```text
Milestone: Pilot Experiment
Milestone: Dataset v1
Milestone: Manuscript Figure 1
Milestone: Manuscript Submission
```

예를 들어 Figure 1에 필요한 실험들을 하나의 Milestone으로 묶을 수 있다.

```text
Figure 1
├── EXP-014
├── EXP-018
├── EXP-021
└── Analysis #62
```

이렇게 하면 논문 준비와 실험 진행이 자연스럽게 연결된다.

---

## 17. Issue Template

`.github/ISSUE_TEMPLATE/experiment.md`

예:

```markdown
---
name: Experiment
about: Discussion and tracking for an experiment
title: "[EXP-XXX] "
labels: experiment
---

## Research Note

<!-- Link to the SSOT research note -->

## Objective

<!-- Short objective only -->

## Status

planned

## Discussion

Use comments for questions, interpretations,
troubleshooting, and follow-up suggestions.
```

자동화가 구축되면 사람이 이 Template을 직접 사용할 일은 줄어든다.

---

## 18. 자동 Issue 생성

목표 사용자 경험은:

```text
1. Obsidian에서 EXP-025 작성

2. Git commit/push

3. 끝
```

그 뒤 자동으로:

```text
GitHub Action
     ↓
changed files 확인
     ↓
type: experiment 확인
     ↓
EXP ID 확인
     ↓
기존 Issue 검색
     ↓
없음
     ↓
Issue 생성
     ↓
experiment label
status label
     ↓
연구노트 링크 추가
```

가 실행된다.

---

## 19. Issue 번호를 노트에 어떻게 되돌릴까?

여기서 중요한 설계 문제가 하나 있다.

Action이 Issue #73을 만들었다고 해서 곧바로 원본 Markdown을 수정해 다시 commit하면 자동 commit이 반복되거나 로컬과 원격 사이에 불필요한 변경이 생길 수 있다.

따라서 초기에는 **Issue 번호를 Frontmatter에 반드시 자동 기록하지 않는 방법**을 권장한다.

대신 GitHub에서:

```text
EXP-025 → Issue #73
```

관계를 검색 가능하게 유지한다.

필요하면 사용자가 다음 pull 이후 직접 연결하거나, 향후 별도의 안전한 동기화 정책을 만든다.

즉:

> 자동화 때문에 SSOT를 계속 기계적으로 수정하는 구조는 피한다.

---

## 20. 더 나은 연결 방법: Experiment ID

실제 핵심 연결 키는 Issue 번호가 아니라 **Experiment ID**로 두는 것이 좋다.

```text
EXP-025
```

가 다음 모든 시스템에서 동일하다.

```text
Obsidian
EXP-025.md

GitHub Issue
[EXP-025] Golden Gate test

Data Storage
/EXP-025/

Wiki Evidence
EXP-025
```

그러면 Issue 번호가 바뀌거나 다른 Git 서비스로 이동하더라도 연구 provenance가 유지된다.

---

## 21. GitHub Discussions는 완전히 없애야 할까?

아니다.

Issues는 **특정 실험이나 작업에 연결된 토론**에 적합하다.

Discussions는 향후 다음과 같은 경우 선택적으로 사용할 수 있다.

```text
"다음 연구 방향은 무엇으로 할까?"

"새로운 assembly strategy를 도입할까?"

"프로젝트 전체의 데이터 표준을 어떻게 정할까?"
```

즉:

```text
Experiment-specific → Issues

Project-wide open discussion → Discussions (optional)
```

로 사용할 수 있다.

하지만 초기 시스템에서는 Issues만으로 시작하는 것이 단순하다.

---

## 22. Wiki와의 연결

Issue에서 합의된 모든 내용을 Wiki로 보내지는 않는다.

흐름은:

```text
Research Note
     ↓
Issue
     ↓
Discussion
     ↓
Evidence + Decision
     ↓
Result synthesis
     ↓
Wiki
```

이다.

Wiki에는 개별 실험의 일지가 아니라 **여러 실험을 통해 현재 지지되는 지식**이 올라간다.

---

## 23. 권장 GitHub Project 활용 — 선택 사항

Issue 수가 많아지면 GitHub Projects를 추가할 수 있다.

예:

```text
Planned
   │
   ▼
In Progress
   │
   ▼
Needs Review
   │
   ├── Repeat
   ├── Failed
   │
   ▼
Completed
```

이를 Kanban 형태로 보면 프로젝트 진행 상황을 한눈에 확인할 수 있다.

초기에는 필수가 아니다.

Issue가 수십 개 이상 쌓이기 시작했을 때 도입해도 늦지 않다.

---

## 24. 사람과 AI의 역할

### 사람

- 실험 수행
- 연구노트 작성
- 과학적 의견 제시
- 결과 해석
- 의사결정 승인
- Wiki의 핵심 주장 승인

### GitHub Actions

- 변경 탐지
- Issue 생성
- Label 관리
- 링크 생성
- 형식 검증

### AI

- 긴 토론 요약
- 미해결 질문 추출
- Decision 후보 작성
- 후속 실험 후보 정리
- Wiki 변경 초안 작성

이 역할을 분리하면 자동화가 연구자의 판단을 침범하지 않는다.

---

## 25. 최종 흐름

```text
              Obsidian
                  │
            EXP-001 작성
                  │
                 Git
                  │
                 push
                  ▼
          GitHub Repository
                  │
           GitHub Actions
                  │
                  ▼
          Issue 자동 생성
                  │
       ┌──────────┼──────────┐
       │          │          │
     의견       질문       리뷰
       │          │          │
       └──────────┼──────────┘
                  ▼
             AI Summary
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
  Decision 후보        Next Experiment
        │                   │
    사람 승인             EXP-004
        │
        ▼
   Decision Note
        │
        ▼
   Result Synthesis
        │
        ▼
       Wiki
        │
        ▼
 Living Manuscript
        │
        ▼
      Paper
```

---

## 26. MVP 권장 범위

첫 구현에서는 욕심을 줄이고 다음만 구현하는 것을 권장한다.

1. `EXP-xxx` 규칙
2. Experiment Note Template
3. Git push
4. 신규 Experiment 감지
5. Issue 자동 생성
6. `experiment` + `status:*` Label
7. Issue에서 연구노트 링크
8. 대용량 파일 commit 차단

AI 요약, Decision Note 자동 초안, Wiki 업데이트 등은 이 기본 흐름이 안정된 뒤 추가한다.

---

## 27. 다음 문서

다음 문서는:

`04_living-manuscript-wiki.md`

에서 다음을 설계한다.

- Wiki를 단순 문서 저장소가 아닌 Living Manuscript로 사용하는 방법
- Overview / Background / Methods / Results / Discussion 구조
- Experiment → Evidence → Result → Wiki 연결
- 실패 실험을 Wiki에서 어떻게 다룰지
- Wiki와 논문 원고의 관계
- AI가 Wiki 업데이트 초안을 만드는 방법
- Wiki 변경의 검토/승인 정책
- 최종 논문으로 export하는 흐름
