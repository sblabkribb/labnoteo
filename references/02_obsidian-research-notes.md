# 02. Obsidian 연구노트 및 Vault 설계

> **목표:** 연구자는 Obsidian에서 자연스럽게 기록하고, 구조화·GitHub 연결·자동화에 필요한 정보는 최소한의 규칙으로 확보한다.

---

## 1. 설계 원칙

앞 문서의 전체 아키텍처에서 Obsidian은 **연구자의 주 작업 공간**이다.

따라서 Vault 설계에서 가장 중요한 원칙은 다음과 같다.

- 연구자가 GitHub 구조를 의식하면서 노트를 작성하지 않아도 된다.
- 기존 연구노트 폴더 구조가 있다면 최대한 유지한다.
- 모든 노트를 복잡한 양식에 맞추지 않는다.
- 자동화에 필요한 정보만 Frontmatter로 구조화한다.
- 노트 사이의 관계는 Obsidian 내부 링크를 적극 활용한다.
- 원시 데이터와 대용량 파일은 Vault/Git에서 분리한다.
- 연구노트의 Markdown 파일이 연구 기록의 SSOT가 된다.
- GitHub Issue와 Wiki는 연구노트를 복제하는 곳이 아니라 연결된 협업/지식 계층이다.

---

## 2. 권장 Vault 구조

새로 시작한다면 다음과 같은 구조를 권장한다.

```text
Research-Vault/
│
├── 00_Inbox/
│
├── 01_Projects/
│   ├── Project-A/
│   │   ├── Project-A.md
│   │   ├── Experiments/
│   │   ├── Results/
│   │   └── Meetings/
│   └── Project-B/
│
├── 02_Protocols/
├── 03_Resources/
├── 04_Decisions/
├── 05_Manuscript/
├── 90_Templates/
├── 99_Archive/
│
├── assets/
├── .obsidian/
├── .github/
└── README.md
```

그러나 **기존 Vault를 이 구조로 강제로 변경할 필요는 없다.**

자동화 스크립트가 현재 폴더 구조를 이해하도록 만드는 편이 더 좋다.

---

## 3. Inbox

`00_Inbox`는 구조를 고민하지 않고 빠르게 기록하는 공간이다.

예:

```text
00_Inbox/
├── 2026-09-10-idea.md
├── meeting-note.md
└── assembly-question.md
```

회의 중 아이디어, 모바일에서 작성한 메모, 갑자기 떠오른 가설 등을 일단 이곳에 기록한다.

나중에 AI 또는 사용자가 적절한 프로젝트/실험에 연결할 수 있다.

즉:

```text
Capture first
      ↓
Classify later
```

라는 원칙이다.

---

## 4. Project Note

각 연구 프로젝트에는 하나의 중심 노트를 둔다.

예:

```text
01_Projects/
└── Lycopene/
    └── Lycopene.md
```

예시:

```markdown
---
type: project
id: PRJ-LYCOPENE
status: active
---

# Lycopene Project

## Objective

Inter-biofoundry comparison of Golden Gate assembly.

## Hypotheses

- [[HYP-001]]
- [[HYP-002]]

## Experiments

- [[EXP-001]]
- [[EXP-002]]
- [[EXP-003]]

## Important Results

- [[RES-001]]

## Decisions

- [[DEC-001]]

## Manuscript

[[Lycopene Manuscript]]
```

이 노트는 프로젝트의 **Hub/MOC(Map of Content)** 역할을 한다.

---

## 5. 실험 노트

가장 중요한 기본 단위는 Experiment Note다.

파일명은 사람이 읽기 쉬우면서 고유 ID를 갖도록 한다.

예:

```text
EXP-001_Golden-Gate-temperature-test.md
EXP-002_Transformation-volume-test.md
```

### 최소 Frontmatter

```yaml
---
type: experiment
id: EXP-001
project: PRJ-LYCOPENE
status: in-progress
date: 2026-09-10
issue:
---
```

처음에는 이 정도면 충분하다.

GitHub 자동화가 Issue를 생성한 뒤 `issue`를 연결할 수 있다.

---

## 6. 권장 실험 노트 템플릿

```markdown
---
type: experiment
id: EXP-001
project: PRJ-LYCOPENE
status: planned
date: 2026-09-10
issue:
data:
---

# EXP-001 Golden Gate temperature test

## Objective

이번 실험에서 확인하려는 질문.

## Hypothesis

[[HYP-001]]

## Experimental Design

실험 조건과 설계.

## Protocol

[[Golden Gate Assembly Protocol]]

필요한 변경 사항만 여기에 기록한다.

## Materials

- DNA parts
- enzyme
- vector

## Execution

실제로 수행한 과정과 계획에서 달라진 점을 기록한다.

## Observations

실험 중 관찰한 내용.

## Results

결과 및 그림.

## Interpretation

현재 시점의 해석.

## Problems / Unexpected Events

실패, 오류, 예상하지 못한 현상.

## Next Steps

- [ ] 추가 분석
- [ ] 반복 실험
- [ ] 조건 변경

## Related

- Project: [[Lycopene]]
- Protocol: [[Golden Gate Assembly Protocol]]
- Result:
- Decision:

## External Data

대용량 데이터 위치 또는 데이터 ID.
```

중요한 점은 모든 섹션을 매번 채우도록 강제하지 않는 것이다.

---

## 7. 실험 상태

실험은 성공/실패만으로 표현하기 어렵다.

권장 상태는:

```text
planned
in-progress
completed
failed
discontinued
needs-repeat
```

예:

```yaml
status: failed
```

`failed`는 기록을 삭제해야 한다는 의미가 아니다.

오히려 실패 원인과 관찰 결과가 중요한 연구 정보가 된다.

---

## 8. Hypothesis Note

가설을 별도 객체로 만들면 여러 실험이 하나의 가설을 검증하는 관계를 표현하기 쉽다.

예:

```markdown
---
type: hypothesis
id: HYP-001
status: testing
---

# HYP-001

Increasing the assembly temperature will improve...

## Rationale

...

## Supporting Experiments

- [[EXP-001]]
- [[EXP-004]]

## Contradicting Evidence

- [[EXP-007]]
```

Graph에서는:

```text
HYP-001
  ├── EXP-001
  ├── EXP-004
  └── EXP-007
```

처럼 보이게 된다.

---

## 9. Result Note는 필요할 때만

모든 실험 결과를 별도 Result 파일로 만들 필요는 없다.

중요한 결과가 여러 실험을 종합하여 만들어졌을 때만 별도 Result Note를 만든다.

예:

```markdown
---
type: result
id: RES-001
project: PRJ-LYCOPENE
---

# RES-001

Condition B consistently showed higher assembly efficiency.

## Evidence

- [[EXP-014]]
- [[EXP-018]]
- [[EXP-021]]

## Interpretation

...

## Related Decision

[[DEC-004]]
```

이 Result Note는 나중에 Wiki의 Results 섹션으로 연결하기 좋다.

---

## 10. Decision Note

연구 방향을 바꾸는 중요한 결정은 별도 기록한다.

```markdown
---
type: decision
id: DEC-003
date: 2026-09-10
status: accepted
---

# DEC-003 Stop condition C

## Decision

Condition C 실험을 중단한다.

## Why

반복적으로 낮은 효율이 관찰되었다.

## Evidence

- [[EXP-021]]
- [[EXP-024]]

## GitHub Discussion

Issue #51

## Consequence

다음 실험에서는 condition B와 D에 집중한다.
```

모든 사소한 결정을 기록할 필요는 없다.

**나중에 "왜 이렇게 했지?"라고 물을 가능성이 높은 결정**을 기록하는 것이 기준이다.

---

## 11. Protocol Note

프로토콜은 실험마다 복사하지 않는다.

```text
02_Protocols/
├── Golden-Gate-Assembly.md
├── Transformation.md
└── Plasmid-Prep.md
```

실험에서는:

```markdown
## Protocol

[[Golden Gate Assembly Protocol]]

Changes:
- incubation time: 60 → 90 min
```

처럼 **기준 프로토콜 + 실제 변경점**을 기록한다.

이렇게 해야 동일한 프로토콜을 사용하는 실험을 Graph로 추적할 수 있다.

---

## 12. Obsidian 내부 링크

폴더보다 더 중요한 것이 링크다.

예:

```markdown
Project: [[Lycopene]]

Hypothesis: [[HYP-001]]

Protocol: [[Golden Gate Assembly Protocol]]

Related experiment: [[EXP-004]]

Decision: [[DEC-003]]
```

이를 통해 단순한 파일 트리가 아니라 연구 지식 그래프가 만들어진다.

```text
                  Project
                     │
                 Hypothesis
                  /     \
             EXP-001   EXP-004
                │         │
             Protocol   Result
                \         /
                 DEC-003
```

---

## 13. Graph View 활용

전체 Vault Graph는 노트가 많아지면 복잡해진다.

따라서 **Local Graph**가 특히 유용하다.

예를 들어 `EXP-001`에서 Local Graph를 열면:

```text
           HYP-001
              │
Protocol ── EXP-001 ── Project
              │
           RES-001
              │
           DEC-003
```

처럼 해당 실험의 맥락을 빠르게 볼 수 있다.

Graph는 예쁜 그림을 만드는 것이 목적이 아니라 **연구의 provenance와 관계를 탐색하는 인터페이스**로 사용한다.

---

## 14. GitHub Issue 연결

실험 노트와 Issue는 1:1 연결을 기본값으로 한다.

```yaml
issue: 37
```

Obsidian에서 링크를 직접 클릭하고 싶다면 다음처럼 둘 수도 있다.

```yaml
github_issue: https://github.com/ORG/REPO/issues/37
```

또는 본문에:

```markdown
## Collaboration

GitHub Issue: #37
```

자동화가 이 정보를 생성하도록 할 수 있다.

---

## 15. 연구자가 직접 입력해야 하는 정보 최소화

좋지 않은 방식:

```yaml
id:
project:
author:
created:
modified:
issue:
wiki:
github:
storage:
status:
reviewer:
version:
...
```

매번 15~20개의 필드를 입력하게 만들면 연구노트 작성 자체가 부담이 된다.

초기에는 다음 정도를 권장한다.

```yaml
---
type: experiment
id: EXP-001
project: PRJ-001
status: in-progress
date: 2026-09-10
---
```

나머지는 자동화가 계산하거나 필요한 경우에만 추가한다.

---

## 16. 대용량 데이터 연결

대용량 파일은 Vault 밖에 둔다.

예:

```text
Research-Vault/
   EXP-001.md

Research-Data/
   PRJ-LYCOPENE/
       EXP-001/
           raw/
           processed/
```

노트에서는:

```yaml
data: storage://PRJ-LYCOPENE/EXP-001/
```

처럼 참조한다.

가능하다면 단순한 로컬 절대경로보다 팀 전체에서 의미가 유지되는 URI 또는 데이터 ID를 사용하는 것이 좋다.

---

## 17. 이미지와 작은 첨부파일

작은 그림과 스크린샷은 Vault에 포함해도 된다.

예:

```text
assets/
└── EXP-001/
    ├── figure-01.png
    └── plate-layout.svg
```

노트:

```markdown
![[assets/EXP-001/figure-01.png]]
```

다만 이미지가 매우 많거나 커지기 시작하면 연구 데이터 스토리지로 이동하는 정책을 둔다.

---

## 18. Git 사용

사용자는 가능하면 Obsidian Git 플러그인을 통해:

```text
노트 작성
   ↓
자동 commit
   ↓
자동 push
```

정도만 경험하도록 한다.

GitHub Actions는 push 이후의 작업을 담당한다.

```text
push
 ↓
변경된 experiment 탐지
 ↓
metadata 검증
 ↓
Issue 확인
 ↓
필요하면 Issue 생성
 ↓
label/status 연결
```

---

## 19. `.obsidian` 폴더

Obsidian 설정과 플러그인 정보도 Git으로 공유할 수 있지만 모든 파일을 공유하는 것은 권장하지 않는다.

팀 공통으로 필요한:

- templates
- plugin 설정 일부
- workspace 규칙
- 공통 metadata 규칙

등은 버전 관리할 수 있다.

반면 사용자별 UI 상태, 캐시, 개인 workspace 정보 등은 `.gitignore` 대상으로 검토한다.

초기 구축 시 실제 `.obsidian` 내부 파일을 확인한 뒤 ignore 정책을 결정하는 것이 안전하다.

---

## 20. 모바일 사용

모바일에서는 모든 연구 데이터를 내려받는 구조를 피한다.

Git Repository에는 Markdown 중심의 가벼운 정보가 있기 때문에:

- GitHub 앱/웹에서 Issue 확인
- GitHub 웹에서 연구노트 확인
- Issue 댓글 작성
- Wiki 확인

등이 가능하다.

즉, 연구자는 Obsidian을 주로 사용하지만 공동연구자는 Obsidian 설치 없이 GitHub만으로도 참여할 수 있다.

---

## 21. 연구노트에서 논문까지

이 구조의 장기적인 정보 흐름은:

```text
Quick Note
    ↓
Experiment
    ↓
Observation
    ↓
Result
    ↓
Issue discussion
    ↓
Decision / Interpretation
    ↓
Living Manuscript
    ↓
Paper
```

이다.

중요한 것은 논문을 마지막에 처음부터 다시 쓰는 것이 아니라, **연구가 진행되는 동안 논문의 근거 구조가 함께 성장하도록 하는 것**이다.

---

## 22. 권장 최소 운영 규칙

초기에는 다음 7가지만 팀 규칙으로 정해도 충분하다.

1. 연구 기록의 원본은 Obsidian Markdown이다.
2. 실험에는 고유한 `EXP-xxx` ID를 부여한다.
3. 실험 상태를 Frontmatter에 기록한다.
4. 관련 노트는 Obsidian `[[link]]`로 연결한다.
5. 실험에 대한 협업 의견은 GitHub Issue에 기록한다.
6. 중요한 의사결정만 Decision Note로 승격한다.
7. 대용량 원시 데이터는 Git에 넣지 않는다.

나머지는 사용하면서 점진적으로 추가한다.

---

## 23. 다음 단계

다음 문서에서는 이 구조의 핵심 협업 계층인 GitHub Issues를 상세 설계한다.

`03_github-issues.md`

주요 내용:

- Experiment ↔ Issue 자동 연결
- Issue Template
- Label 체계
- 실험 상태와 Issue 상태의 관계
- 댓글 운영 규칙
- 회의에서 Issue 활용
- Issue에서 Decision Note 생성
- GitHub Actions 자동 생성 흐름
- AI 요약 및 후속 작업 추출

그 이후 `04_living-manuscript-wiki.md`에서 연구 결과가 Wiki의 Living Manuscript로 성장하는 구조를 설계한다.
