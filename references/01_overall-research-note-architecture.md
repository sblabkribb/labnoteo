# Obsidian + GitHub 기반 연구노트 시스템 설계안

> **설계 원칙:** 연구자는 가능하면 Obsidian에서 연구 기록에 집중하고, GitHub는 버전 관리·협업·진행 관리·공유를 담당한다.  
> **핵심 구조:** **Obsidian → Git Repository (SSOT) → GitHub Issues → GitHub Wiki (Living Manuscript)**

---

## 1. 목표

이 시스템의 목표는 단순히 연구노트를 GitHub에 백업하는 것이 아니다.

1. 연구 과정과 원자료의 맥락을 지속적으로 기록한다.
2. 연구노트의 변경 이력을 Git으로 보존한다.
3. 각 실험에 대한 의견과 의사결정을 연구노트와 분리하면서도 연결한다.
4. 성공뿐 아니라 실패·중단·재실험도 연구 과정의 일부로 추적한다.
5. 축적된 결과를 점진적으로 정리하여 Wiki를 **Living Manuscript**로 발전시킨다.
6. 반복적인 연결·생성·요약 작업은 GitHub Actions와 AI로 최대한 자동화한다.
7. 대용량 연구 데이터는 Git 저장소와 분리하여 관리한다.

---

## 2. 전체 아키텍처

```text
                    연구자
                      │
                      ▼
             ┌─────────────────┐
             │    Obsidian     │
             │ 연구노트 작성/탐색 │
             │ Graph / AI      │
             └────────┬────────┘
                      │
                 Git commit/push
                      │
                      ▼
             ┌─────────────────┐
             │ GitHub Repository│
             │       SSOT       │
             │ Markdown / Code  │
             └────────┬────────┘
                      │
                GitHub Actions
              ┌───────┴────────┐
              ▼                ▼
       ┌─────────────┐   ┌──────────────┐
       │GitHub Issues│   │ GitHub Wiki  │
       │토론/진행/결정 │   │Living        │
       │댓글/상태관리  │   │Manuscript    │
       └─────────────┘   └──────────────┘

대용량 데이터
    │
    └────▶ NAS / Object Storage / 연구 데이터 서버
                    ▲
                    │
            노트에는 URI/ID/경로 기록
```

가장 중요한 것은 **Repository의 Markdown 연구노트가 SSOT(Single Source of Truth)**라는 점이다.

GitHub Issue와 Wiki가 원본 연구노트를 복제하는 구조로 만들지 않는다.

---

## 3. 각 구성요소의 역할

### 3.1 Obsidian — 연구자의 주 작업 공간

Obsidian에서는 평소처럼 Markdown으로 연구노트를 작성한다.

주요 역할:

- 실험 계획
- 실험 과정 기록
- 관찰 사항
- 결과 및 해석
- 이미지/도표와 데이터 링크
- 관련 노트 간 `[[Internal Link]]`
- 태그와 Frontmatter
- Graph View를 통한 연구 내용 연결 관계 탐색
- AI 플러그인을 통한 요약, 검색, 초안 작성
- Git 플러그인을 통한 commit/push

즉, **연구자가 가장 많이 보는 인터페이스는 Obsidian**이 되도록 한다.

---

## 4. GitHub Repository — 연구노트의 SSOT

Repository에는 가급적 다음만 저장한다.

- Markdown 연구노트
- 작은 이미지/도표
- 분석 코드
- 설정 파일
- 프로토콜
- 문서
- 메타데이터
- 자동화 스크립트

예시:

```text
research-vault/
├── projects/
│   ├── project-a/
│   │   ├── overview.md
│   │   ├── experiments/
│   │   │   ├── EXP-001.md
│   │   │   ├── EXP-002.md
│   │   │   └── EXP-003.md
│   │   ├── protocols/
│   │   └── analysis/
│   └── project-b/
│
├── decisions/
├── templates/
├── assets/
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── .gitignore
└── README.md
```

기존 Obsidian Vault 구조가 이미 있다면 이를 대대적으로 변경하기보다 자동화 계층을 기존 구조에 맞추는 것이 좋다.

---

## 5. 연구노트와 Frontmatter

각 실험 노트에 최소한의 구조화된 메타데이터를 둘 수 있다.

```yaml
---
id: EXP-001
title: Golden Gate assembly test
project: project-a
status: in-progress
date: 2026-09-10
issue: 37
data:
  - storage://project-a/EXP-001/
---
```

여기서 `issue: 37`은 해당 연구노트와 연결된 GitHub Issue 번호다.

Frontmatter는 연구자가 정보를 두 번 입력하게 만드는 용도가 아니라 **자동화가 노트를 이해하기 위한 최소한의 metadata**로 사용하는 것이 좋다.

---

## 6. GitHub Issues — 연구 협업과 진행 관리

이번 설계에서는 Discussions보다 **Issues를 기본 협업 계층**으로 사용한다.

### 왜 Issues인가?

연구 실험은 단순한 토론 주제가 아니라 상태를 가진 작업이기 때문이다.

예를 들어:

```text
planned
   ↓
in-progress
   ↓
completed
```

또는

```text
in-progress
   ├── failed
   ├── discontinued
   └── needs-repeat
```

Issue에는 다음을 활용할 수 있다.

- 댓글
- Labels
- Assignee
- Open/Closed 상태
- Milestone
- 다른 Issue/PR 링크
- 연구노트 링크

따라서 **실험 하나 ↔ Issue 하나**를 기본 모델로 사용할 수 있다.

---

## 7. Issue에 연구노트 전체를 복사하지 않는다

중복을 피하는 것이 중요하다.

Issue 본문에는 전체 실험 내용을 붙여넣기보다 다음 정도만 둔다.

```markdown
## Experiment

EXP-001 — Golden Gate assembly test

## Research Note

[Open research note](../blob/main/projects/project-a/experiments/EXP-001.md)

## Purpose

Golden Gate assembly condition comparison.

## Discussion

Please add experimental observations, questions,
interpretations, and suggestions as comments.
```

즉:

**Research Note = 실험 기록**

**Issue = 실험을 둘러싼 대화와 진행 상태**

로 역할을 분리한다.

---

## 8. 실패하거나 중단된 실험

실패한 실험도 삭제하지 않는다.

예:

```yaml
status: failed
```

또는

```yaml
status: discontinued
```

Issue에는 다음과 같은 Label을 사용할 수 있다.

```text
experiment
status:planned
status:in-progress
status:completed
status:failed
status:discontinued
needs-repeat
needs-review
```

실패 이유와 다른 연구자의 의견은 Issue 댓글에 남길 수 있다.

이 정보는 향후 같은 실패를 반복하지 않도록 하는 중요한 연구 자산이 된다.

---

## 9. GitHub Wiki — Living Manuscript

Wiki는 개별 실험의 원본 저장소가 아니다.

Wiki의 역할은:

> **현재까지 연구를 통해 무엇을 알게 되었는가?**

를 지속적으로 정리하는 것이다.

예를 들어 Wiki를 다음과 같이 구성할 수 있다.

```text
Home
│
├── Research Overview
├── Background
├── Hypotheses
├── Methods
├── Results
│   ├── Result 1
│   ├── Result 2
│   └── Result 3
├── Discussion
├── Limitations
├── Future Work
└── References
```

연구 초기에는 간단한 개요 수준이지만 연구가 진행되면서 내용이 점차 논문 형태로 성장한다.

최종적으로는 Wiki 자체가 논문 원고의 상당 부분을 구성할 수 있다.

---

## 10. Evidence 연결

Wiki의 주장과 실제 실험 사이의 연결을 유지하는 것이 중요하다.

예:

```markdown
### Assembly efficiency

Condition B produced higher assembly efficiency than condition A.

Evidence:
- EXP-014
- EXP-018
- EXP-021

Related Issues:
- #43
- #51
```

따라서 다음과 같은 provenance가 생긴다.

```text
Manuscript statement
        ↓
Research Note
        ↓
Experiment
        ↓
Raw Data
```

반대로:

```text
Raw Data
   ↓
Research Note
   ↓
Issue discussion
   ↓
Interpretation
   ↓
Wiki / Manuscript
```

이 구조는 향후 AI가 연구 근거를 추적하는 데도 유용하다.

---

## 11. GitHub Actions 자동화

자동화의 기본 원칙은 다음과 같다.

> **기계적인 작업은 자동화하고, 과학적 판단은 사람이 승인한다.**

### Push 후 자동 처리

```text
Obsidian
   │
   │ Git push
   ▼
GitHub
   │
   ▼
GitHub Actions
   │
   ├── 변경된 연구노트 탐지
   ├── Frontmatter 검사
   ├── 신규 실험 여부 확인
   ├── Issue 존재 여부 확인
   ├── 필요 시 Issue 생성
   ├── Label 적용
   └── 링크 연결
```

---

## 12. AI 자동화

AI는 다음과 같은 보조 역할을 할 수 있다.

### 연구노트 → Issue

AI가 다음을 짧게 추출한다.

- 실험 목적
- 현재 상태
- 주요 질문

단, 전체 연구노트를 Issue에 복제하지 않는다.

### Issue 댓글 → 결정 후보

Issue 댓글이 길어지면 AI가:

```text
Key discussion points
Decision candidates
Unresolved questions
Suggested next experiments
```

등을 생성할 수 있다.

### 연구 결과 → Wiki 초안

AI가 새로운 결과를 감지하여:

> "이 결과를 Results 페이지에 추가할까요?"

와 같은 Wiki 변경 초안을 생성할 수 있다.

가능하면 Wiki를 즉시 자동 변경하기보다는 **PR 또는 사람이 검토할 수 있는 제안**으로 만드는 것이 안전하다.

---

## 13. Decision Notes

모든 Issue 댓글을 Repository로 복사할 필요는 없다.

대신 연구 방향을 바꾸는 중요한 결정만 별도의 Decision Note로 남길 수 있다.

예:

```text
decisions/
├── DEC-001-change-assembly-temperature.md
├── DEC-002-switch-vector.md
└── DEC-003-stop-condition-c.md
```

예시 내용:

```markdown
# DEC-003 Stop condition C

## Decision

Condition C experiments will be discontinued.

## Reason

Repeated low transformation efficiency.

## Evidence

- EXP-021
- EXP-024

## Discussion

GitHub Issue #51
```

이렇게 하면 Git에는 **중요한 연구 의사결정의 역사**가 남는다.

---

## 14. 대용량 연구 데이터

FASTQ, BAM, 영상, 현미경 데이터, 대규모 분석 결과 등은 일반 Git Repository에 넣지 않는 것을 기본 원칙으로 한다.

대신:

```text
NAS
Object Storage
S3-compatible Storage
Institutional Storage
Data Server
```

등에 저장한다.

연구노트에는 데이터의 위치만 기록한다.

예:

```yaml
data:
  raw: storage://project-a/EXP-001/raw/
  processed: storage://project-a/EXP-001/processed/
```

또는 DOI, accession, object ID 등을 사용할 수 있다.

---

## 15. 큰 파일의 Git 유입 방지

`.gitignore`만으로는 실수로 큰 파일이 추가되는 것을 완전히 막기 어렵다.

따라서 **pre-commit hook**을 추가하는 것이 좋다.

예를 들어:

```text
< 10 MB       → 정상
10–50 MB      → 경고
> 50 MB       → commit 차단
```

차단 시:

```text
Large research data detected.

Please move this file to the research data storage
and add its storage URI to the research note.
```

처럼 안내한다.

파일을 자동 이동시키는 것보다는 **commit을 차단하고 사용자가 확인하도록 하는 방식**을 권장한다. 자동 이동은 Obsidian 링크나 분석 코드의 경로를 깨뜨릴 수 있기 때문이다.

---

## 16. Obsidian Graph의 역할

Obsidian의 Graph View는 GitHub Wiki와 별개의 기능으로 유지한다.

Graph는 다음 관계를 탐색하는 데 사용한다.

```text
Project
 ├── Hypothesis
 ├── Experiment
 │    ├── Protocol
 │    ├── Sample
 │    └── Analysis
 ├── Result
 └── Decision
```

연구노트 내부의 `[[EXP-001]]`, `[[Protocol-GoldenGate]]` 같은 링크가 연구 지식 네트워크를 형성한다.

GitHub는 이를 대체하는 것이 아니라 **외부 협업 및 버전 관리 계층**을 제공한다.

---

## 17. 모바일 및 회의에서의 활용

이 구조에서는 모든 사람이 Obsidian을 사용할 필요가 없다.

### 주 연구자

```text
Obsidian
↓
Git
↓
GitHub
```

### 공동 연구자

GitHub에서:

```text
Issue 열기
→ 연구노트 링크 확인
→ 댓글 작성
```

### 회의

Issue를 열어:

- 현재 상태
- 최근 댓글
- 미해결 질문
- 다음 실험

을 검토할 수 있다.

따라서 GitHub Issues가 일종의 **연구 협업 인터페이스** 역할을 한다.

---

## 18. 권장 자동화 수준

처음부터 모든 것을 자동화하면 시스템 유지가 연구 자체보다 복잡해질 수 있다.

### Phase 1 — MVP

먼저:

```text
Obsidian
+ Git
+ GitHub Repository
+ GitHub Issues
```

만 구축한다.

자동화:

- Git push
- 대용량 파일 검사
- 신규 실험 노트 탐지
- Issue 자동 생성
- 노트 ↔ Issue 연결

### Phase 2 — Wiki

다음으로:

```text
GitHub Wiki
```

를 추가하여 Living Manuscript를 구축한다.

### Phase 3 — AI

이후:

- 연구노트 요약
- Issue 댓글 요약
- 미해결 질문 추출
- 다음 실험 후보 제안
- Wiki 업데이트 초안
- Decision Note 초안

등을 자동화한다.

### Phase 4 — 고도화

필요하다면:

- NAS/Object Storage 연계
- 연구 데이터 ID 자동 발급
- provenance graph
- ontology/schema
- RAG
- MCP/agent
- 자동 manuscript generation

으로 발전시킬 수 있다.

---

## 19. 최종 권장 구조

```text
              ┌─────────────────────────┐
              │        Obsidian         │
              │                         │
              │ Notes / Graph / AI      │
              └────────────┬────────────┘
                           │
                         Git
                           │
                           ▼
              ┌─────────────────────────┐
              │    GitHub Repository    │
              │                         │
              │ Research Note = SSOT    │
              └────────────┬────────────┘
                           │
                    GitHub Actions
                ┌──────────┼───────────┐
                │          │           │
                ▼          ▼           ▼
             Issues     AI Agent    Wiki
                │          │           │
          Discussion    Summary      Living
          Progress      Suggestion   Manuscript
          Decisions        │           │
                └──────────┴───────────┘
                           │
                           ▼
                      Publication

              ┌─────────────────────────┐
              │ Research Data Storage   │
              │ NAS / Object Storage    │
              └─────────────────────────┘
```

---

## 20. 한 문장으로 정리

이 시스템의 핵심은 다음과 같다.

> **Obsidian에서 연구하고, Git에서 기록을 보존하고, Issues에서 함께 논의하며, Wiki에서 지식을 축적하여 최종적으로 논문으로 발전시킨다.**

그리고 이 과정에서 GitHub Actions와 AI는 연구자가 같은 내용을 여러 번 입력하지 않도록 뒤에서 자동화하는 역할을 맡는다.

---

## 다음 설계 문서

이 전체 설계를 기준으로 이후 문서를 다음처럼 분리하면 관리하기 좋다.

1. `01_overall-architecture.md` — 전체 구조
2. `02_obsidian-research-notes.md` — Obsidian Vault 및 연구노트 규칙
3. `03_github-issues.md` — 실험 ↔ Issue 협업 모델
4. `04_living-manuscript-wiki.md` — Wiki 및 논문화 구조
5. `05_github-actions.md` — GitHub Actions 자동화 상세 설계
6. `06_ai-automation.md` — AI 요약·의사결정·Wiki 초안 자동화
7. `07_large-data-management.md` — 대용량 데이터 및 pre-commit 정책
8. `08_implementation-roadmap.md` — 실제 구축 순서와 MVP
