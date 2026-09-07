# LLM response fixtures

Raw HTTP response bodies from the two supported providers, replayed by
`tests/plugin/providerFixtures.test.ts` through the real `LlmProvider` code.

## Why these exist

The hand-written tests in `provider.test.ts` assert that we emit and parse the
shapes the *documentation* describes. That is one step removed from the truth:
if a provider's actual payload differs from its docs, no test notices. These
fixtures close that gap by pinning the parser against bodies a real server sent.

They also separate two things that change for different reasons — the wire data
(refreshable by anyone with a running server) and our parsing logic (code).

## Provenance

Each fixture carries a `recordedFrom` field.

- `"documentation-example"` — seeded from the provider's official docs, **not**
  a live recording. Same epistemic weight as a hand-written test; it exists so
  the replay harness has something to run until someone refreshes it.
- Anything else (e.g. `"ollama qwen3 @ http://localhost:11434"`) — a real
  recording, with `recordedAt` set.

Check this field before trusting a fixture as evidence about a provider.

## Refreshing

```bash
# Ollama (model must have the "tools" capability)
OLLAMA_MODEL=qwen3 node scripts/recordLlmFixtures.mjs ollama

# OpenAI
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o-mini node scripts/recordLlmFixtures.mjs openai
```

The recorder always sends the same prompts and tool schema, so a refreshed
fixture stays comparable to the one it replaces. The tests assert *structural*
properties (a tool call named `get_weather` whose `location` mentions Toronto)
rather than exact strings, so re-recording does not churn them — but a genuine
change in the wire format still fails.
