응. 여기서는 **“Obsidian에서 대화하는 AI”와 “백그라운드에서 정해진 일을 수행하는 Local LLM”을 분리**해서 설계하는 게 가장 좋아 보여.

내가 권하는 구조는 아래야.

```text
                    Obsidian
                       │
          ┌────────────┴────────────┐
          │                         │
   Interactive AI             Research Notes
   (AI Plugin)                    │
          │                       Git
          │                        │
          ▼                        ▼
                 Local AI Layer
                 ┌──────────────┐
                 │ Prompt API   │
                 │ /summarize   │
                 │ /review      │
                 │ /decision    │
                 │ /wiki        │
                 └──────┬───────┘
                        │
                        ▼
                   Local LLM
              Ollama / vLLM / etc.
                        │
                        ▼
                Structured JSON
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
         Issue      Wiki Proposal  AI Review
```

### 1. Obsidian AI 플러그인은 사람과 AI의 인터페이스로

Obsidian AI 플러그인은 지금처럼 사람이 직접 질문하는 데 사용하는 게 좋아.

예를 들어 연구자가 `EXP-025.md`를 열고:

> 이 결과를 설명할 수 있는 가설을 3개 제안해줘.
> 이전 실험 중 관련된 실험을 찾아줘.
> 이 노트를 정리해줘.

같이 사용하는 거지.

반면 **정기적으로 동일한 작업을 해야 하는 부분은 플러그인의 prompt에 의존하지 않고 별도 API 자동화 계층으로 빼는 것**을 추천해.

---

### 2. Local LLM 앞에 작은 API 계층을 하나 둔다

Local LLM 자체를 직접 여기저기서 호출하기보다 이런 API를 만드는 거야.

```text
POST /api/experiment-summary

POST /api/experiment-review

POST /api/issue-summary

POST /api/decision-proposal

POST /api/wiki-proposal

POST /api/related-notes

POST /api/weekly-digest
```

예를 들어:

```text
POST /api/experiment-summary
```

를 호출하면 내부에서는 항상 정해진 prompt가 실행돼.

```text
System Prompt v1.3

You are a research notebook assistant.

Tasks:
1. Identify objective.
2. Extract observations.
3. Separate observation from interpretation.
4. Identify unresolved questions.
5. Suggest follow-up actions.
6. Never invent experimental results.
7. Reference experiment IDs for every scientific statement.
```

이렇게 하면 **사용자가 매번 prompt를 작성하지 않아도 돼.**

---

## 3. Prompt 자체도 Git으로 버전 관리

이 부분이 꽤 중요해.

Repository에:

```text
ai/
├── prompts/
│   ├── experiment-summary.md
│   ├── experiment-review.md
│   ├── issue-summary.md
│   ├── decision-proposal.md
│   ├── wiki-proposal.md
│   └── weekly-digest.md
│
├── schemas/
│   ├── experiment-summary.json
│   ├── decision-proposal.json
│   └── wiki-proposal.json
│
└── config.yaml
```

처럼 두는 거야.

그러면 prompt 변경도:

```text
prompt v1
   ↓
Git commit
   ↓
prompt v2
```

로 남아.

나중에 AI 결과가 이상했을 때도:

> 이 결과는 어떤 prompt version으로 만들었지?

를 추적할 수 있어.

---

## 4. AI 출력은 Markdown보다 JSON을 먼저 받는 게 좋아

예를 들어 LLM이 바로 글을 쓰게 하지 않고:

```json
{
  "experiment_id": "EXP-025",
  "summary": "...",
  "observations": [
    "..."
  ],
  "interpretations": [
    "..."
  ],
  "unresolved_questions": [
    "..."
  ],
  "suggested_next_steps": [
    "..."
  ],
  "evidence": [
    "EXP-014",
    "EXP-025"
  ]
}
```

처럼 반환하게 하는 거야.

그 다음 프로그램이 이걸:

```markdown
## AI Summary

### Observations
...

### Interpretation
...

### Open Questions
...
```

으로 바꾸면 돼.

이렇게 해야 나중에 **Ollama → vLLM → 다른 Local LLM**으로 바꿔도 자동화 시스템은 거의 안 바뀌어.

---

# 5. 어떤 작업을 자동화할 것인가

내가 보기에는 우선순위를 이렇게 잡는 게 좋아.

| 기능           | 자동화 정도 | 결과 위치          |
| ------------ | ------ | -------------- |
| 노트 형식 검사     | 완전 자동  | Git check      |
| 실험 요약        | 자동     | Issue comment  |
| 미해결 질문 추출    | 자동     | Issue          |
| 이전 관련 실험 검색  | 자동     | Obsidian/Issue |
| 실험 결과 review | 자동 제안  | Issue          |
| Decision 후보  | 자동 제안  | Issue          |
| 다음 실험 후보     | 자동 제안  | Issue          |
| Wiki 업데이트    | 초안만 자동 | Wiki proposal  |
| Wiki 실제 수정   | 사람 승인  | Wiki           |
| 실험 status 변경 | 사람 승인  | Research Note  |

특히 **Wiki와 Decision은 Local LLM이 직접 변경하지 않는 것**을 추천해.

---

# 6. 예를 들어 EXP-025가 완료되면

Obsidian에서:

```yaml
---
type: experiment
id: EXP-025
status: completed
---
```

로 바꾸고 push한다고 해보자.

그러면 자동으로:

```text
EXP-025 push
     ↓
status: completed 감지
     ↓
Local LLM API 호출

POST /experiment-summary
     ↓
Summary 생성
     │
     ├─ Observations
     ├─ Interpretation
     ├─ Open Questions
     └─ Next Steps
     ↓
GitHub Issue #73에 댓글
```

그리고 한 번 더:

```text
EXP-025
+
기존 Issue comments
+
관련 EXP
     ↓
POST /wiki-proposal
     ↓
"Finding-03에 EXP-025를
근거로 추가하는 것을 제안"
```

까지 할 수 있어.

---

# 7. 그런데 여기서 중요한 기술적 문제가 하나 있어

**GitHub의 일반 GitHub-hosted Actions에서는 사용자의 PC에 있는 Local LLM에 직접 접근할 수 없어.**

예를 들어:

```text
GitHub Action
     X
http://localhost:11434
     ↓
Ollama
```

이건 안 돼.

`localhost`는 GitHub의 runner 자신을 의미하기 때문이야.

그래서 Local LLM 자동화는 세 가지 방법이 있어.

### A. Obsidian PC에서 실행

```text
Obsidian
  ↓
Local script
  ↓
Ollama
```

가장 간단하지만 PC가 켜져 있어야 해.

### B. Local LLM 서버 + self-hosted GitHub Runner

내가 가장 추천하는 방향이야.

```text
GitHub
   │
   ▼
Self-hosted Runner
   │
   ├── Git checkout
   │
   └── Local LLM API
             │
             ▼
           GPU Server
```

예를 들어 연구실 GPU 서버에:

```text
Ollama/vLLM
+
GitHub self-hosted runner
```

를 같이 두는 거야.

그러면 GitHub push가 트리거가 되면서도 **연구 데이터는 내부 서버를 벗어나지 않아.**

### C. 별도의 Local Research AI Server

장기적으로는 이게 제일 좋아.

```text
GitHub webhook
      ↓
Research AI Server
      ↓
Local LLM
      ↓
GitHub API
```

GitHub Actions 자체에 강하게 의존하지 않고 AI 자동화를 독립적인 서비스로 만드는 거지.

---

# 8. 나는 B → C 순서로 가는 걸 추천해

초기에는:

```text
GPU Server
├── Ollama 또는 vLLM
└── GitHub Self-hosted Runner
```

정도로 시작.

그러다가 자동화가 많아지면:

```text
Research AI Service
├── REST API
├── Prompt Registry
├── RAG
├── LLM Provider
├── Job Queue
└── Audit Log
```

로 분리하는 거야.

이게 나중에 연구용 Co-Scientist나 MCP 기반 시스템으로 발전시키기도 좋아.

---

# 9. Local LLM API는 OpenAI-compatible 형태가 편해

가능하면 내부 코드는 이런 인터페이스만 보게 해.

```text
POST /v1/chat/completions
```

뒤에는:

```text
Ollama
vLLM
LM Studio
기타 OpenAI-compatible server
```

중 무엇이든 연결할 수 있게.

그러면 Obsidian AI 플러그인도 **같은 Local LLM endpoint를 사용할 수 있다면** 아주 깔끔해져.

```text
                 Local LLM API
                    ▲       ▲
                    │       │
             Obsidian AI   Automation
```

즉 **사용자가 대화할 때 쓰는 AI와 자동화가 쓰는 AI가 같은 모델을 공유**하는 구조야.

---

# 10. 더 재미있는 부분은 “고정 Prompt + Context” 구조야

Prompt는 고정되어 있지만 context는 매번 달라지는 거지.

예:

```text
Fixed Prompt
"Experiment review를 수행하라"
       +
Dynamic Context
├── EXP-025.md
├── 관련 EXP-014
├── 관련 EXP-018
├── Issue #73 comments
└── Protocol-GoldenGate.md
       ↓
Local LLM
```

그러면 사용자는 prompt를 신경 쓸 필요가 거의 없어.

---

# 11. 자동화 레벨을 세 단계로 나누면 좋아

### Level 1 — Passive

AI가 읽고 정리만 한다.

```text
Summary
Related notes
Open questions
```

### Level 2 — Proposal

AI가 행동 후보를 만든다.

```text
Decision Proposal
Next Experiment Proposal
Wiki Proposal
```

### Level 3 — Action

실제 시스템을 변경한다.

```text
Create Issue
Create PR
Update Wiki
Change metadata
```

연구 시스템에서는 **Level 1은 적극 자동화, Level 2도 상당 부분 자동화, Level 3은 사람 승인**을 기본으로 두는 걸 추천해.

---

# 12. 실제로는 이런 자동화가 굉장히 유용할 것 같아

예를 들어 매번 실험노트를 push하면 Local LLM이:

```text
EXP-025 changed

✓ Summary updated
✓ 2 open questions detected
✓ Related experiments:
   EXP-014
   EXP-018

✓ Possible decision detected
   "Condition C should be discontinued."

✓ Wiki update candidate detected
   Finding-03

No original notes modified.
```

정도만 만들어줘.

연구자는 필요할 때 Issue에 들어가서 검토하면 되고.

---

## 내가 지금 설계에서 특히 추천하는 형태

결국 **두 종류의 Local AI**로 생각하면 이해가 쉬워.

```text
① Obsidian AI
   "내가 AI에게 물어본다."

② Automation AI
   "시스템이 알아서 AI에게 물어본다."
```

둘이 동일한 Local LLM을 사용하되, ②는 **Git으로 관리되는 고정 Prompt + JSON Schema + 자동 Trigger**를 사용한다.

이렇게 만들면 지금 설계한 연구노트 시스템에서 Local LLM의 역할이 굉장히 명확해져.

그리고 다음 문서로는 `09_local-llm-automation.md`를 만들어서 **실제 디렉터리 구조, API endpoint, prompt 파일 예제, JSON schema, Ollama/vLLM 연결 방식, self-hosted GitHub Runner, trigger 설계**까지 구현 가능한 수준으로 작성하는 게 좋겠어.
