// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import { NodeFileSystem } from '../nodeFileSystem';

/**
 * NodeFileSystem is the VS Code / Node implementation of the LabnoteFs port.
 * These tests run in the `core` vitest project (NO vscode mock), against a
 * real temp directory, and pin the contract shared logic relies on.
 */
describe('NodeFileSystem', () => {
  let dir: string;
  const nfs = new NodeFileSystem();

  beforeEach(() => {
    dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'labnoteo-nfs-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips text through write/read', async () => {
    const p = nodePath.join(dir, 'a.txt');
    await nfs.write(p, 'héllo 한글');
    expect(await nfs.read(p)).toBe('héllo 한글');
  });

  it('reports existence for files and directories', async () => {
    const p = nodePath.join(dir, 'b.txt');
    expect(await nfs.exists(p)).toBe(false);
    await nfs.write(p, 'x');
    expect(await nfs.exists(p)).toBe(true);
    expect(await nfs.exists(dir)).toBe(true);
  });

  it('creates nested directories recursively and is idempotent', async () => {
    const nested = nodePath.join(dir, 'x', 'y', 'z');
    await nfs.mkdir(nested);
    await nfs.mkdir(nested); // no throw on re-create
    expect(fs.statSync(nested).isDirectory()).toBe(true);
  });

  it('writes create parent directories on demand', async () => {
    const p = nodePath.join(dir, 'deep', 'nested', 'c.json');
    await nfs.write(p, '{}');
    expect(await nfs.read(p)).toBe('{}');
  });

  it('lists entry names (not full paths), empty for missing dir', async () => {
    expect(await nfs.list(nodePath.join(dir, 'nope'))).toEqual([]);
    await nfs.write(nodePath.join(dir, 'one.json'), '1');
    await nfs.write(nodePath.join(dir, 'two.json'), '2');
    await nfs.mkdir(nodePath.join(dir, 'sub'));
    const names = (await nfs.list(dir)).sort();
    expect(names).toEqual(['one.json', 'sub', 'two.json']);
  });

  it('atomically replaces an existing file (no leftover temp files)', async () => {
    const p = nodePath.join(dir, 'atomic.json');
    await nfs.write(p, 'v1');
    await nfs.write(p, 'v2');
    expect(await nfs.read(p)).toBe('v2');
    // No sibling temp artifacts left behind.
    const leftovers = fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  it('remove deletes a file and is a no-op when absent', async () => {
    const p = nodePath.join(dir, 'gone.txt');
    await nfs.write(p, 'x');
    await nfs.remove(p);
    expect(await nfs.exists(p)).toBe(false);
    await expect(nfs.remove(p)).resolves.toBeUndefined(); // no throw
  });

  it('read rejects for a missing file', async () => {
    await expect(nfs.read(nodePath.join(dir, 'missing.txt'))).rejects.toBeTruthy();
  });
});
