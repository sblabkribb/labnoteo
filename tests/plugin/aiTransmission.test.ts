import { afterEach, describe, it, expect, vi } from 'vitest';
import { draftMethodCommand } from '../../src/llm/commands';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { __setRequestUrlHandler } from '../stubs/obsidian';
import type LabnotePlugin from '../../src/main';
import type { EditTarget } from '@labnoteo/core';

vi.mock('../../src/modals', () => ({ aiAnswerModal: vi.fn() }));

function fixture() {
  const data = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} } });
  let text = '# A note\n\nRecord a method here.\n';
  const target: EditTarget = { path: 'Welcome.md', getText: async () => text,
    getCursorOffset: async () => text.length, insertAtCursor: vi.fn(),
    replaceRange: vi.fn(async (from, to, value) => { text = text.slice(0, from) + value + text.slice(to); }) };
  const confirm = vi.fn().mockResolvedValue(false);
  const plugin = {
    settings: { ...DEFAULT_SETTINGS, llmProvider: 'openai', llmEndpointOpenai: 'https://original.test', llmModel: 'test' },
    app: { loadLocalStorage: (key: string) => data.get(key), saveLocalStorage: (key: string, value: string) => data.set(key, value),
      workspace: { getActiveViewOfType: () => null }, vault: { getFileByPath: () => null } },
    host: { editTarget: () => target, confirm, notify: vi.fn() }, markUserEdit: vi.fn(),
    t: (key: string, ...args: string[]) => args.reduce((s, value, index) => s.replace(`{${index}}`, value), key),
  } as unknown as LabnotePlugin;
  return { plugin, confirm, target, data };
}

afterEach(() => { __setRequestUrlHandler(null); vi.unstubAllGlobals(); });

describe('AI commands transmit only after consent', () => {
  it('cancel sends no HTTP request and changes no note or consent storage', async () => {
    const { plugin, confirm, target, data } = fixture();
    const request = vi.fn(); __setRequestUrlHandler(request);
    await draftMethodCommand(plugin);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('https://original.test/v1/chat/completions');
    expect(request).not.toHaveBeenCalled();
    expect(target.replaceRange).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it('uses the confirmed destination even when settings change while the dialog is open', async () => {
    const { plugin, confirm } = fixture();
    confirm.mockImplementationOnce(async () => { plugin.settings.llmEndpointOpenai = 'https://changed.test'; return true; });
    const request = vi.fn(() => ({ status: 200, json: { choices: [{ message: { content: 'A method' } }] }, text: '', headers: {} }));
    __setRequestUrlHandler(request);
    await draftMethodCommand(plugin);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]).toBeDefined();
    expect((request.mock.calls as unknown as [{ url: string }][])[0][0].url).toBe('https://original.test/v1/chat/completions');
  });
});
