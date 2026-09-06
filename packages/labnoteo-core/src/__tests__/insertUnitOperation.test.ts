// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { insertUnitOperationAtCursor } from '../commands/insertUnitOperation';
import { MemFileSystem } from '../fs/memFileSystem';
import type { EditTarget, LabnoteHost, NotifyKind } from '../host';

/** Minimal test host: records notifications and captures inserted text. */
function makeHost(opts: {
  targetPath?: string;
  fs?: MemFileSystem;
}): {
  host: LabnoteHost;
  notes: Array<{ kind: NotifyKind; message: string }>;
  inserted: string[];
} {
  const notes: Array<{ kind: NotifyKind; message: string }> = [];
  const inserted: string[] = [];
  const fs = opts.fs ?? new MemFileSystem();

  const target: EditTarget | undefined = opts.targetPath
    ? {
        path: opts.targetPath,
        async getText() {
          return '';
        },
        async insertAtCursor(text: string) {
          inserted.push(text);
        },
        async replaceRange() {
          /* not used here */
        },
      }
    : undefined;

  const host: LabnoteHost = {
    fs,
    async pick() {
      return undefined;
    },
    async pickMany() {
      return [];
    },
    async prompt() {
      return undefined;
    },
    async confirm() {
      return false;
    },
    notify(kind, message) {
      notes.push({ kind, message });
    },
    editTarget() {
      return target;
    },
    async openFile() {
      /* noop */
    },
    t(key, ...args) {
      // Mirror vscode.l10n.t positional substitution so assertions can check
      // the interpolated message.
      return args.length
        ? key.replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)] ?? ''))
        : key;
    },
  };

  return { host, notes, inserted };
}

const VALID_WORKFLOW = '/vault/labnote/001_Exp/002_WD010_Design.labnote.md';

describe('insertUnitOperationAtCursor', () => {
  it('inserts a HW template at the cursor for a valid workflow path', async () => {
    const { host, inserted, notes } = makeHost({ targetPath: VALID_WORKFLOW });

    const ok = await insertUnitOperationAtCursor(host, {
      opId: 'UHW010',
      opName: 'Centrifugation',
      opDescription: 'spin down',
      opType: 'hw',
      equipment: 'Centrifuge 5424',
    });

    expect(ok).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toContain('### [UHW010 Centrifugation]');
    expect(inserted[0]).toContain('- Equipment: Centrifuge 5424');
    expect(notes.at(-1)).toEqual({
      kind: 'info',
      message: 'Unit operation inserted: UHW010 Centrifugation',
    });
  });

  it('reads the experimenter from the sibling README front matter', async () => {
    const fs = new MemFileSystem();
    await fs.write(
      '/vault/labnote/001_Exp/README.labnote.md',
      '---\nauthor: Dr. Kim\n---\n# Notes\n'
    );
    const { host, inserted } = makeHost({ targetPath: VALID_WORKFLOW, fs });

    await insertUnitOperationAtCursor(host, {
      opId: 'USW010',
      opName: 'Alignment',
      opType: 'sw',
      software: 'BWA',
    });

    expect(inserted[0]).toContain('- Experimenter: Dr. Kim');
    expect(inserted[0]).toContain('- Software: BWA');
  });

  it('bails and warns when there is no active edit target', async () => {
    const { host, inserted, notes } = makeHost({});

    const ok = await insertUnitOperationAtCursor(host, {
      opId: 'UHW010',
      opName: 'X',
      opType: 'hw',
    });

    expect(ok).toBe(false);
    expect(inserted).toHaveLength(0);
    expect(notes.at(-1)?.kind).toBe('warn');
  });

  it('bails when the active document is not a valid workflow file', async () => {
    const { host, inserted, notes } = makeHost({
      targetPath: '/vault/labnote/001_Exp/README.labnote.md',
    });

    const ok = await insertUnitOperationAtCursor(host, {
      opId: 'UHW010',
      opName: 'X',
      opType: 'hw',
    });

    expect(ok).toBe(false);
    expect(inserted).toHaveLength(0);
    expect(notes.at(-1)?.kind).toBe('warn');
  });

  it('errors when required op info is missing', async () => {
    const { host, inserted, notes } = makeHost({ targetPath: VALID_WORKFLOW });

    const ok = await insertUnitOperationAtCursor(host, {
      opId: '',
      opName: '',
      opType: 'hw',
    });

    expect(ok).toBe(false);
    expect(inserted).toHaveLength(0);
    expect(notes.at(-1)?.kind).toBe('error');
  });
});
