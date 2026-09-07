// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { MemFileSystem } from '../fs/memFileSystem';
import { createLabnoteTools, runTool, type ToolContext } from '../tools';

const README = [
  '---',
  'title: 001 Test',
  'author: Dr. Kim',
  'created_date: 2026-01-01',
  '---',
  '',
  '## Related Workflows',
  '',
  '> Workflows are listed here.',
  '',
].join('\n');

const NOTE_DIR = 'labnote/001_Test';
const NOTE_PATH = `${NOTE_DIR}/001_WD010_Design.labnote.md`;

let fs: MemFileSystem;
let ctx: ToolContext;

beforeEach(async () => {
  fs = new MemFileSystem();
  await fs.write(`${NOTE_DIR}/README.labnote.md`, README);
  ctx = { fs, workspaceRoot: '.', globalSampleFolder: 'resources/labsamples' };
});

function tool(name: string) {
  const t = createLabnoteTools().find(x => x.name === name);
  if (!t) throw new Error(`tool ${name} missing`);
  return t;
}

describe('labnote tools — registry', () => {
  it('exposes the documented tools with input schemas', () => {
    const names = createLabnoteTools().map(t => t.name).sort();
    expect(names).toEqual(
      [
        'create_sample',
        'create_workflow',
        'get_sample',
        'get_unit_operation',
        'list_samples',
        'update_section',
      ].sort()
    );
    for (const t of createLabnoteTools()) {
      expect(t.inputSchema.type).toBe('object');
      expect(typeof t.description).toBe('string');
    }
  });

  it('runTool reports unknown tools', async () => {
    const res = await runTool(createLabnoteTools(), 'nope', ctx, {});
    expect(res.ok).toBe(false);
  });
});

describe('create_sample / get_sample / list_samples', () => {
  it('creates then reads back a sample by id', async () => {
    const created = await tool('create_sample').handler(ctx, {
      type: 'DNA',
      id: 'DNA-1',
      alias: 'plasmidA',
      description: 'first',
      documentPath: NOTE_PATH,
    });
    expect(created.ok).toBe(true);
    expect((created.data as { id: string }).id).toBe('DNA-1');

    const got = await tool('get_sample').handler(ctx, {
      type: 'DNA',
      id: 'DNA-1',
      documentPath: NOTE_PATH,
    });
    expect(got.ok).toBe(true);
    expect(got.data).toMatchObject({ id: 'DNA-1', alias: 'plasmidA' });
  });

  it('auto-generates an id when none is given', async () => {
    const res = await tool('create_sample').handler(ctx, {
      type: 'RNA',
      documentPath: NOTE_PATH,
    });
    expect(res.ok).toBe(true);
    expect((res.data as { id: string }).id).toMatch(/^RNA-/);
  });

  it('lists samples of a type', async () => {
    await tool('create_sample').handler(ctx, { type: 'DNA', id: 'DNA-1', documentPath: NOTE_PATH });
    await tool('create_sample').handler(ctx, { type: 'DNA', id: 'DNA-2', documentPath: NOTE_PATH });
    const res = await tool('list_samples').handler(ctx, { type: 'DNA', documentPath: NOTE_PATH });
    expect(res.ok).toBe(true);
    expect((res.data as Array<{ id: string }>).map(s => s.id).sort()).toEqual(['DNA-1', 'DNA-2']);
  });

  it('get_sample fails for a missing sample', async () => {
    const res = await tool('get_sample').handler(ctx, {
      type: 'DNA',
      id: 'DNA-999',
      documentPath: NOTE_PATH,
    });
    expect(res.ok).toBe(false);
  });
});

describe('get_unit_operation', () => {
  it('returns catalog info for a known unit op', async () => {
    // Ensure the catalog is materialised, then pick a real op id.
    const { loadUnitOperations, ensureWorkflowResources } = await import(
      '../lib/workflowDataLoader'
    );
    await ensureWorkflowResources(fs, '.');
    const hw = await loadUnitOperations(fs, '.', 'hw');
    const sample = hw.unitOperations[0];
    expect(sample).toBeDefined();

    const res = await tool('get_unit_operation').handler(ctx, { opId: sample.id });
    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ id: sample.id, opType: 'hw' });
  });

  it('fails for an unknown op id', async () => {
    const res = await tool('get_unit_operation').handler(ctx, { opId: 'ZZZ999' });
    expect(res.ok).toBe(false);
  });
});

describe('update_section', () => {
  it('replaces a section body non-lossily', async () => {
    const doc = ['## [WD010 Design]', '', '#### Method', '', 'old', '', '#### Results', '', 'r', ''].join(
      '\n'
    );
    await fs.write(NOTE_PATH, doc);
    const res = await tool('update_section').handler(ctx, {
      documentPath: NOTE_PATH,
      heading: 'Method',
      content: 'NEW method',
    });
    expect(res.ok).toBe(true);
    const after = await fs.read(NOTE_PATH);
    expect(after).toContain('NEW method');
    expect(after).not.toContain('old');
    expect(after).toContain('#### Results');
  });

  it('fails when the section is absent', async () => {
    await fs.write(NOTE_PATH, '## Only\n\nx\n');
    const res = await tool('update_section').handler(ctx, {
      documentPath: NOTE_PATH,
      heading: 'Missing',
      content: 'x',
    });
    expect(res.ok).toBe(false);
  });
});

describe('create_workflow', () => {
  it('creates a workflow file and registers it in the README', async () => {
    const { loadWorkflows, ensureWorkflowResources } = await import('../lib/workflowDataLoader');
    await ensureWorkflowResources(fs, '.');
    const catalog = await loadWorkflows(fs, '.');
    const wf = catalog.workflows[0];

    const res = await tool('create_workflow').handler(ctx, {
      documentPath: `${NOTE_DIR}/README.labnote.md`,
      workflowId: wf.id,
    });
    expect(res.ok).toBe(true);
    const { path } = res.data as { path: string };
    expect(await fs.exists(path)).toBe(true);

    const readme = await fs.read(`${NOTE_DIR}/README.labnote.md`);
    expect(readme).toContain(wf.id);
  });

  it('fails for an unknown workflow id', async () => {
    const res = await tool('create_workflow').handler(ctx, {
      documentPath: `${NOTE_DIR}/README.labnote.md`,
      workflowId: 'NOPE999',
    });
    expect(res.ok).toBe(false);
  });
});

// `mutates` drives the host's "allow this write?" prompt, so a tool marked
// read-only that quietly writes would bypass user consent entirely. Rather than
// restate the flags (a change-detector test that proves nothing), run each
// read-only tool and assert the vault is byte-identical afterwards.
describe('ToolDef.mutates', () => {
  it('every tool declares whether it mutates', () => {
    for (const t of createLabnoteTools()) {
      expect(typeof t.mutates, `${t.name}.mutates`).toBe('boolean');
    }
  });

  /** Plausible args per tool, so handlers get far enough to write if they would. */
  const argsFor: Record<string, Record<string, unknown>> = {
    get_sample: { type: 'DNA', id: 'DNA-1', documentPath: NOTE_PATH },
    list_samples: { type: 'DNA', documentPath: NOTE_PATH },
    get_unit_operation: { opId: 'UHW010' },
  };

  it('read-only tools leave the vault untouched', async () => {
    const { ensureWorkflowResources } = await import('../lib/workflowDataLoader');
    // Seed the catalog first: lazily creating it is allowed (invisible to the
    // user), and we want to catch writes beyond that.
    await ensureWorkflowResources(fs, '.');
    await runTool(createLabnoteTools(), 'create_sample', ctx, {
      type: 'DNA',
      id: 'DNA-1',
      documentPath: NOTE_PATH,
    });

    for (const t of createLabnoteTools().filter(x => !x.mutates)) {
      const before = fs.snapshot();
      await t.handler(ctx, argsFor[t.name] ?? {});
      expect(fs.snapshot(), `${t.name} wrote to the vault but is marked read-only`).toEqual(before);
    }
  });

  it('mutating tools actually change the vault', async () => {
    const before = fs.snapshot();
    const res = await runTool(createLabnoteTools(), 'create_sample', ctx, {
      type: 'DNA',
      id: 'DNA-1',
      documentPath: NOTE_PATH,
    });
    expect(res.ok).toBe(true);
    expect(fs.snapshot()).not.toEqual(before);
  });
});

// A note the AI edits may be open in the host's editor, whose buffer would
// overwrite a raw filesystem write on its next flush. Hosts that have an
// editor-aware write path supply it as `ctx.writeNote`.
describe('ctx.writeNote hook', () => {
  /** Records calls and applies them, so later reads see the change. */
  const spyHook = (target: MemFileSystem) => {
    const calls: Array<{ path: string; content: string }> = [];
    return {
      calls,
      writeNote: async (path: string, content: string) => {
        calls.push({ path, content });
        await target.write(path, content);
      },
    };
  };

  it('update_section writes through the hook instead of fs', async () => {
    const hook = spyHook(fs);
    await fs.write(NOTE_PATH, '## [WD010 Design]\n\n#### Method\n\nold\n');

    const res = await tool('update_section').handler(
      { ...ctx, writeNote: hook.writeNote },
      { documentPath: NOTE_PATH, heading: 'Method', content: 'NEW' }
    );

    expect(res.ok).toBe(true);
    expect(hook.calls.map(c => c.path)).toEqual([NOTE_PATH]);
    expect(await fs.read(NOTE_PATH)).toContain('NEW');
  });

  it('create_workflow routes both the new file and the README through the hook', async () => {
    const { loadWorkflows, ensureWorkflowResources } = await import('../lib/workflowDataLoader');
    await ensureWorkflowResources(fs, '.');
    const wf = (await loadWorkflows(fs, '.')).workflows[0];
    const readmePath = `${NOTE_DIR}/README.labnote.md`;
    const hook = spyHook(fs);

    const res = await tool('create_workflow').handler(
      { ...ctx, writeNote: hook.writeNote },
      { documentPath: readmePath, workflowId: wf.id }
    );

    expect(res.ok).toBe(true);
    const { path } = res.data as { path: string };
    expect(hook.calls.map(c => c.path)).toEqual([path, readmePath]);
  });

  it('falls back to fs.write when no hook is supplied', async () => {
    await fs.write(NOTE_PATH, '## [WD010 Design]\n\n#### Method\n\nold\n');
    const res = await tool('update_section').handler(ctx, {
      documentPath: NOTE_PATH,
      heading: 'Method',
      content: 'NEW',
    });
    expect(res.ok).toBe(true);
    expect(await fs.read(NOTE_PATH)).toContain('NEW');
  });

  it('is not used for sample data files, which are not notes', async () => {
    const hook = spyHook(fs);
    const res = await tool('create_sample').handler(
      { ...ctx, writeNote: hook.writeNote },
      { type: 'DNA', id: 'DNA-1', documentPath: NOTE_PATH }
    );
    expect(res.ok).toBe(true);
    expect(hook.calls).toEqual([]);
  });
});
