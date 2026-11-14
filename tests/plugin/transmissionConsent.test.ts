import { describe, it, expect, vi } from 'vitest';
import { TransmissionConsent } from '../../src/llm/transmissionConsent';

function memory() {
  const entries = new Map<string, unknown>();
  return { get: <T>(key: string) => entries.get(key) as T | undefined, set: (key: string, value: unknown) => { entries.set(key, value); } };
}

describe('AI transmission consent', () => {
  it('shares concurrent confirmation, persists only accepted addresses, and reuses it after restart', async () => {
    const store = memory();
    let decide!: (ok: boolean) => void;
    const confirm = vi.fn(() => new Promise<boolean>(resolve => { decide = resolve; }));
    const gate = new TransmissionConsent(store, confirm);
    const first = gate.allow('openai', 'https://example.test/v1/chat/completions');
    const second = gate.allow('openai', 'https://example.test/v1/chat/completions');
    await Promise.resolve();
    expect(confirm).toHaveBeenCalledTimes(1);
    decide(true);
    expect(await first).toBe(true); expect(await second).toBe(true);
    const restarted = new TransmissionConsent(store, vi.fn(() => Promise.resolve(false)));
    expect(await restarted.allow('openai', 'https://example.test/v1/chat/completions')).toBe(true);
    expect(await restarted.allow('openai', 'https://other.test/v1/chat/completions')).toBe(false);
  });
  it('does not save a cancellation and asks again for a later request', async () => {
    const store = memory(); const save = vi.spyOn(store, 'set');
    const confirm = vi.fn().mockResolvedValue(false);
    const gate = new TransmissionConsent(store, confirm);
    expect(await gate.allow('ollama', 'http://host/api/chat')).toBe(false);
    expect(await gate.allow('ollama', 'http://host/api/chat')).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2); expect(save).not.toHaveBeenCalled();
  });
});
