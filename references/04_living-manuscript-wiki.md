# 04. GitHub Wiki 기반 Living Manuscript 설계

> **목표:** GitHub Wiki를 연구노트의 복사본이 아니라, 연구가 진행될수록 근거와 해석이 축적되어 최종 논문으로 발전하는 **Living Manuscript**로 사용한다.

---

## 1. Wiki의 역할

전체 시스템에서 각 계층은 서로 다른 질문에 답한다.

```text
Obsidian Research Note
"무엇을 했는가?"

GitHub Issue
"무엇을 논의하고 있는가?"

Decision Note
"왜 이 결정을 내렸는가?"

GitHub Wiki
"현재까지 무엇을 알게 되었는가?"

Paper
"외부에 무엇을 주장하고 보고할 것인가?"
```

따라서 Wiki에는 실험노트 전체를 복사하지 않는다.

Wiki는 **여러 연구 기록을 종합한 현재의 연구 지식 상태**를 표현한다.

---

## 2. Living Manuscript란?

전통적인 방식은 연구가 거의 끝난 후 논문을 작성한다.

```text
Experiments
    ↓
Experiments
    ↓
Experiments
    ↓
Research finished
    ↓
Start writing paper
```

Living Manuscript 방식은 다르다.

```text
Research question
      ↓
Initial manuscript structure
      ↓
Experiment
      ↓
Evidence update
      ↓
Manuscript update
      ↓
Next experiment
      ↓
Evidence update
      ↓
Manuscript update
      ↓
Final paper
```

즉 **연구와 글쓰기를 분리하지 않는다.**

---

## 3. Wiki를 너무 일찍 '논문 문장'으로 만들지 않는다

초기 연구에서는 결과가 바뀔 가능성이 크다.

따라서 처음부터 완성된 논문 문장을 유지하려 하지 않는다.

초기:

```markdown
## Current Findings

- Condition B appears better than A.
- Evidence is preliminary.
- EXP-014 and EXP-018 support this observation.
- Replication is required.
```

근거가 쌓이면:

```markdown
## Assembly Efficiency

Condition B consistently showed higher assembly efficiency
than condition A across three independent experiments.

Evidence:
- EXP-014
- EXP-018
- EXP-021
```

마지막 단계에서 논문 문장으로 다듬는다.

---

## 4. 권장 Wiki 구조

프로젝트가 하나라면:

```text
Home
│
├── 01 Research Overview
├── 02 Background
├── 03 Research Questions & Hypotheses
├── 04 Methods
├── 05 Results
├── 06 Discussion
├── 07 Limitations
├── 08 Future Work
├── 09 Decisions
├── 10 Evidence Index
└── 11 References
```

여러 프로젝트를 하나의 Repository에서 관리한다면 프로젝트별 Landing Page를 두는 것이 좋다.

```text
Home
├── Project A
│   ├── Overview
│   ├── Methods
│   ├── Results
│   └── Discussion
└── Project B
```

---

## 5. Home

Home은 현재 연구 상태를 빠르게 파악할 수 있는 Dashboard 역할을 한다.

예:

```markdown
# Lycopene Assembly Project

## Objective

Evaluate reproducibility of Golden Gate assembly across conditions.

## Current Status

Active

## Current Main Findings

1. Condition B shows the most consistent assembly efficiency.
2. Condition C has been discontinued.
3. Transformation volume remains under evaluation.

## Active Experiments

- EXP-025
- EXP-027
- EXP-031

## Results Under Review

- RES-004
- RES-006

## Important Decisions

- DEC-003
- DEC-007

## Manuscript Status

Results section: 40%
Discussion: preliminary
```

---

## 6. Research Overview

여기에는 연구의 큰 그림을 둔다.

```markdown
# Research Overview

## Problem

...

## Objective

...

## Research Questions

1. ...
2. ...

## Overall Strategy

...

## Expected Contribution

...
```

이 페이지는 프로젝트가 진행되어도 비교적 안정적이다.

논문의 Introduction과 연구 목적의 기반이 된다.

---

## 7. Hypotheses

Obsidian의 Hypothesis Note와 연결한다.

예:

```markdown
# Hypotheses

## HYP-001

Increasing X will improve Y.

Status: Supported / Uncertain / Rejected

Evidence:
- EXP-001
- EXP-004
- EXP-007
```

중요한 것은 **가설이 틀렸다고 해서 삭제하지 않는 것**이다.

예:

```text
HYP-001 → rejected
```

역시 연구의 중요한 결과다.

---

## 8. Methods

Methods에는 개별 실험의 모든 실행 기록을 복사하지 않는다.

대신 연구 전체에서 사용한 **안정된 방법**을 정리한다.

```markdown
# Golden Gate Assembly

## Standard Method

...

## Deviations

Specific deviations are documented in individual experiment notes.

Related protocol:
Golden Gate Assembly Protocol

Evidence:
EXP-001, EXP-004, EXP-014 ...
```

실험마다 다른 세부 조건은 Research Note에 남는다.

---

## 9. Results의 핵심 단위는 Experiment가 아니라 Finding

Wiki Results를:

```text
EXP-001
EXP-002
EXP-003
EXP-004
```

순으로 쓰는 것은 권장하지 않는다.

이것은 연구일지에 가깝다.

대신:

```text
Finding 1: Condition B improves assembly efficiency

Finding 2: Fragment number affects reproducibility

Finding 3: Transformation volume contributes to variability
```

처럼 **과학적 발견/주장 단위**로 구성한다.

---

## 10. Finding 구조

예:

```markdown
## Finding 01 — Condition B improves assembly efficiency

### Current Conclusion

Condition B currently shows higher and more reproducible
assembly efficiency than conditions A and C.

### Confidence

Moderate

### Supporting Evidence

- EXP-014
- EXP-018
- EXP-021

### Contradicting Evidence

- EXP-017

### Related Discussions

- Issue #43
- Issue #51

### Related Decisions

- DEC-003

### Open Questions

- Does the effect remain with a larger construct?
- Is the effect site-dependent?
```

이 구조가 Living Manuscript의 핵심이다.

---

## 11. Confidence 표시

초기 결과와 확립된 결과를 구분하는 것이 유용하다.

예:

```text
preliminary
low
moderate
high
```

또는:

```text
🟡 Preliminary
🟢 Supported
🔴 Contradicted
```

자동화에는 텍스트 vocabulary가 더 안정적이다.

예:

```yaml
confidence: preliminary
```

중요한 것은 AI가 confidence를 임의로 확정하지 않도록 하는 것이다.

---

## 12. 실패 실험은 Wiki에 어떻게 반영할까?

모든 실패 실험을 Results 본문에 나열할 필요는 없다.

그러나 실패가 과학적 해석에 영향을 준다면 포함한다.

예:

```markdown
### Limitation

Condition C could not be reliably evaluated because repeated
assembly attempts produced insufficient colonies.

Evidence:
- EXP-021
- EXP-024
- EXP-026
```

또는 실패 자체가 중요한 결과라면 Finding으로 승격한다.

```text
Finding:
Condition C consistently fails under the tested workflow.
```

즉:

> **실패 여부가 아니라 연구 주장에 영향을 주는지가 Wiki 포함 기준이다.**

---

## 13. Evidence Index

Wiki에 별도의 Evidence Index를 두면 매우 유용하다.

예:

```markdown
# Evidence Index

| ID | Type | Summary | Related Finding |
|---|---|---|---|
| EXP-014 | Experiment | Assembly condition test | Finding 01 |
| EXP-018 | Experiment | Replication | Finding 01 |
| EXP-021 | Experiment | Condition C test | Finding 01 |
| RES-004 | Result | Multi-experiment analysis | Finding 02 |
| DEC-003 | Decision | Stop condition C | Finding 01 |
```

나중에는 GitHub Action이 자동 생성할 수도 있다.

---

## 14. Provenance

궁극적으로 다음 연결이 유지되어야 한다.

```text
Paper Claim
     │
     ▼
Wiki Finding
     │
     ├── EXP-014
     ├── EXP-018
     └── EXP-021
            │
            ▼
        Raw Data
```

그리고 reasoning은:

```text
EXP-014
   │
Issue #43
   │
Discussion
   │
DEC-003
   │
Wiki Finding
```

으로 추적할 수 있다.

이 구조는 사람뿐 아니라 향후 RAG/AI Agent가 연구 근거를 추적하는 데도 중요하다.

---

## 15. Discussion 페이지

논문의 Discussion과 마찬가지로 단순 결과 반복이 아니라 해석을 축적한다.

```markdown
# Discussion

## Interpretation 1

...

Evidence:
- Finding 01
- Finding 03

## Alternative Explanation

...

## Comparison with Previous Work

...

## Remaining Questions

...
```

Issue의 토론 내용 중 중요한 reasoning이 이곳으로 정제된다.

---

## 16. Open Questions

Living Manuscript에는 아직 답하지 못한 질문도 명시하는 것이 좋다.

```markdown
## Open Questions

- [ ] Does fragment number explain the observed variability?
- [ ] Is the result reproducible at another biofoundry?
- [ ] Does construct size affect transformation efficiency?
```

이 질문은 다시 새로운 Experiment로 연결될 수 있다.

```text
Wiki Open Question
       ↓
     EXP-032
       ↓
     Issue
       ↓
     Result
       ↓
   Wiki update
```

따라서 Wiki는 단순 결과 저장소가 아니라 다음 연구를 유도하는 역할도 한다.

---

## 17. Wiki 업데이트를 완전 자동화하지 않는 이유

연구노트가 push될 때마다 AI가 Wiki를 직접 수정하도록 만들 수도 있다.

하지만 권장하지 않는다.

예:

```text
EXP-025 push
     ↓
AI interpretation
     ↓
Wiki automatically changed
```

이 방식은 과학적 해석이 검토 없이 공식 지식으로 들어갈 위험이 있다.

대신:

```text
EXP-025 push
     ↓
AI analysis
     ↓
Wiki Update Proposal
     ↓
Human review
     ↓
Accept
     ↓
Wiki update
```

를 권장한다.

---

## 18. AI Wiki Update Proposal

예를 들어 새로운 실험이 완료되면 AI가 다음 초안을 생성한다.

```markdown
# Proposed Wiki Update

## Target

Results → Finding 01

## New Evidence

EXP-025

## Suggested Change

Add EXP-025 as supporting evidence.

## Suggested Interpretation

The new experiment is consistent with the current conclusion
that condition B provides higher assembly efficiency.

## Confidence Impact

Current: Moderate
Suggested: Moderate

## Reviewer Action

[ ] Accept
[ ] Modify
[ ] Reject
```

이 제안은 Issue, PR 또는 별도 Markdown 파일로 구현할 수 있다.

---

## 19. Wiki와 Git Repository의 기술적 관계

GitHub Wiki도 내부적으로 Git 기반이다.

하지만 연구노트 Repository와 Wiki는 별도의 저장 공간으로 생각하는 것이 안전하다.

따라서:

```text
Main Repository
= evidence / notes / code / decisions

Wiki
= synthesized knowledge
```

로 역할을 분리한다.

Wiki를 Main Repository의 자동 복제본으로 만들 필요가 없다.

---

## 20. Wiki 변경 이력

Wiki를 사용하면 페이지 변경 이력을 남길 수 있다.

따라서 연구 진행에 따라:

```text
Finding 01

v1: Preliminary observation
v2: Replicated twice
v3: Contradicting result found
v4: Revised interpretation
```

처럼 지식이 어떻게 변화했는지 추적할 수 있다.

이것이 Living Manuscript의 중요한 장점이다.

---

## 21. Wiki와 Obsidian의 중복 최소화

다음처럼 역할을 나누면 중복이 크게 줄어든다.

### Obsidian

```text
실험 상세 기록
개인/팀 연구 메모
프로토콜
관찰
분석
Hypothesis
Decision
```

### Issue

```text
질문
댓글
리뷰
회의 논의
후속 작업
```

### Wiki

```text
현재의 결론
통합된 Results
해석
근거 목록
논문 구조
```

같은 내용을 세 군데 복사하지 않는다.

---

## 22. 논문 Figure 중심으로도 연결 가능

연구가 진행되면 Finding을 논문 Figure와 연결할 수 있다.

예:

```text
Figure 1
├── Finding 01
│   ├── EXP-014
│   └── EXP-018
│
├── Finding 02
│   ├── EXP-021
│   └── EXP-025
│
└── Analysis-004
```

Wiki 페이지:

```markdown
# Figure 1

## Message

Condition B improves assembly reproducibility.

## Panels

### Figure 1A

Evidence:
- EXP-014
- EXP-018

### Figure 1B

Evidence:
- EXP-021
- EXP-025
```

논문 작성 단계에서 매우 유용하다.

---

## 23. Manuscript Ready 단계

연구가 충분히 진행되면 Wiki 구조를 실제 논문 구조에 가깝게 전환한다.

```text
Abstract
Introduction
Results
  ├── Result 1
  ├── Result 2
  └── Result 3
Discussion
Methods
References
```

초기 Research Overview나 Open Questions 등의 내부 페이지는 계속 유지할 수 있다.

---

## 24. 최종 논문 생성

최종 단계에서는 Wiki만 보고 논문을 만드는 것이 아니라:

```text
Wiki
+
Research Notes
+
Decision Notes
+
Analysis
+
Figures
+
References
```

를 함께 사용한다.

AI가 초안을 만들 경우에도 Evidence ID를 유지하도록 한다.

예:

```text
Draft sentence
    ↓
Finding-01
    ↓
EXP-014, EXP-018, EXP-021
```

따라서 생성된 문장의 근거를 다시 확인할 수 있다.

---

## 25. 논문 제출 후에도 Wiki는 가치가 있다

Paper가 출판되더라도 Living Manuscript를 끝낼 필요는 없다.

예:

```text
Paper v1 published
       ↓
new experiments
       ↓
new evidence
       ↓
updated Wiki
       ↓
follow-up paper
```

따라서 Wiki는 특정 논문보다 더 긴 수명을 가진 **프로젝트 지식 베이스**가 될 수 있다.

---

## 26. 권장 자동화 수준

### Phase 1

사람이 Wiki를 직접 업데이트한다.

### Phase 2

AI가 변경된 Experiment/Result를 요약한다.

### Phase 3

AI가 Wiki Update Proposal을 생성한다.

### Phase 4

사람이 승인하면 Wiki에 반영한다.

### Phase 5

Evidence graph와 manuscript draft를 자동 생성한다.

핵심 원칙:

> **자동 생성보다 자동 제안이 먼저다.**

---

## 27. 전체 정보 흐름

```text
                 Research Question
                        │
                        ▼
                    Hypothesis
                        │
                        ▼
                    Experiment
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
       Research Note              Raw Data
            │
            ▼
       GitHub Issue
            │
       Discussion
            │
       ┌────┴────┐
       ▼         ▼
   Decision    Follow-up
       │       Experiment
       │
       ▼
     Result
       │
       ▼
   Wiki Finding
       │
       ├── Supporting Evidence
       ├── Contradicting Evidence
       ├── Confidence
       └── Open Questions
       │
       ▼
     Discussion
       │
       ▼
 Living Manuscript
       │
       ▼
      Figure
       │
       ▼
      Paper
```

---

## 28. 최소 운영 규칙

Wiki를 시작할 때는 다음 정도만 합의해도 충분하다.

1. Wiki에 실험노트 전체를 복사하지 않는다.
2. Results는 Experiment가 아니라 Finding 단위로 작성한다.
3. 중요한 주장에는 `EXP-xxx` 등의 Evidence ID를 붙인다.
4. 상충하는 결과도 숨기지 않고 연결한다.
5. 초기 결과는 preliminary임을 표시한다.
6. AI는 Wiki 변경을 제안할 수 있지만 과학적 결론은 사람이 승인한다.
7. Wiki는 최종 논문이 아니라 계속 변화하는 현재의 연구 지식 상태다.

---

## 29. 다음 문서

다음 문서는:

`05_github-actions.md`

에서 실제 자동화 계층을 설계한다.

주요 내용:

- Obsidian Git push 감지
- 변경된 Markdown 파일 탐색
- Frontmatter parsing
- `EXP-xxx` validation
- 신규 Experiment → Issue 자동 생성
- status → GitHub Label 동기화
- 대용량 파일 감지
- pre-commit과 GitHub Actions의 역할 분리
- Wiki Update Proposal 생성
- AI 자동화가 들어갈 지점
- 자동 commit으로 인한 loop/conflict 방지
- 필요한 GitHub 권한과 Secret 설계
- 단계별 MVP workflow 파일 구성

이 문서부터는 개념 설계에서 한 단계 더 나아가 **실제로 Repository에 넣을 `.github/workflows/*.yml` 구조**까지 설계한다.
