/**
 * `moveSampleInteractive` must move a sample between the folders the Samples
 * sidebar is *currently showing*, not folders it re-derives from the active
 * file. The regression this pins: a Global -> Local move used to resolve its
 * Local target from `plugin.localSampleFolder()`, which follows the active note
 * / last-opened experiment. If focus had moved since the tree was drawn, the
 * sample landed in a different experiment than the one the user right-clicked.
 *
 * The fix threads the rendered folders in as `fromFolder`/`toFolder`, so these
 * tests deliberately point `plugin.localSampleFolder()` at a WRONG experiment
 * and assert the move ignores it.
 */
import { describe, it, expect } from 'vitest';
import type { App } from 'obsidian';
import type LabnotePlugin from '../../src/main';
import { moveSampleInteractive } from '../../src/sampleActions';
import { MemFileSystem } from '../../packages/labnoteo-core/src/fs/memFileSystem';
import {
  putSampleRecord,
  loadSamplesByType,
  type SampleRecord,
} from '../../packages/labnoteo-core/src/lib/sampleStorage';

const GLOBAL = 'resources/labsamples';
const RENDERED_LOCAL = 'labnote/111_Shown/resources/labsamples';
const WRONG_LOCAL = 'labnote/999_Stale/resources/labsamples';
const TYPE = 'Reagent';

function record(alias: string): SampleRecord {
  return { type: TYPE, alias, descriptions: [], sources: [] };
}

/**
 * Minimal plugin double. `localSampleFolder` is pointed at the WRONG experiment
 * on purpose: the fixed move must never consult it.
 */
function makePlugin(fs: MemFileSystem) {
  let refreshed = 0;
  const plugin = {
    fs,
    t: (key: string, ...args: string[]) =>
      args.reduce<string>((s, a, i) => s.replace(`{${i}}`, a), key),
    localSampleFolder: () => WRONG_LOCAL,
    refreshSampleViews: () => {
      refreshed += 1;
    },
  };
  return { plugin: plugin as unknown as LabnotePlugin, getRefreshed: () => refreshed };
}

// confirmModal is only reached on a destination-id conflict, which these tests
// avoid; a bare object is enough to satisfy the type.
const APP = {} as unknown as App;

describe('moveSampleInteractive — targets the rendered folder', () => {
  it('moves Global -> Local into the shown experiment, not the active-file one', async () => {
    const fs = new MemFileSystem();
    await putSampleRecord(fs, GLOBAL, TYPE, 'Reagent-1', record('water'));
    const { plugin, getRefreshed } = makePlugin(fs);

    const moved = await moveSampleInteractive(APP, plugin, {
      fromScope: 'global',
      fromFolder: GLOBAL,
      toFolder: RENDERED_LOCAL,
      type: TYPE,
      id: 'Reagent-1',
    });

    expect(moved).toBe(true);
    // Landed in the folder the tree rendered…
    const local = await loadSamplesByType(fs, RENDERED_LOCAL, TYPE);
    expect(local['Reagent-1']).toEqual(record('water'));
    // …never in the (stale) folder localSampleFolder() points at…
    expect(await loadSamplesByType(fs, WRONG_LOCAL, TYPE)).toEqual({});
    // …and the source no longer holds it.
    expect(await loadSamplesByType(fs, GLOBAL, TYPE)).toEqual({});
    expect(getRefreshed()).toBe(1);
  });

  it('moves Local -> Global into the rendered global folder', async () => {
    const fs = new MemFileSystem();
    await putSampleRecord(fs, RENDERED_LOCAL, TYPE, 'Reagent-2', record('buffer'));
    const { plugin } = makePlugin(fs);

    const moved = await moveSampleInteractive(APP, plugin, {
      fromScope: 'local',
      fromFolder: RENDERED_LOCAL,
      toFolder: GLOBAL,
      type: TYPE,
      id: 'Reagent-2',
    });

    expect(moved).toBe(true);
    expect((await loadSamplesByType(fs, GLOBAL, TYPE))['Reagent-2']).toEqual(record('buffer'));
    expect(await loadSamplesByType(fs, RENDERED_LOCAL, TYPE)).toEqual({});
  });

  it('refuses to move when a scope folder is unresolved (empty), writing nothing', async () => {
    const fs = new MemFileSystem();
    await putSampleRecord(fs, GLOBAL, TYPE, 'Reagent-3', record('x'));
    const { plugin, getRefreshed } = makePlugin(fs);
    const before = fs.snapshot();

    const moved = await moveSampleInteractive(APP, plugin, {
      fromScope: 'global',
      fromFolder: GLOBAL,
      toFolder: '', // Local scope not resolvable (no experiment rendered yet)
      type: TYPE,
      id: 'Reagent-3',
    });

    expect(moved).toBe(false);
    // Nothing written, nothing deleted — the sample stays put in Global.
    expect(fs.snapshot()).toEqual(before);
    expect(getRefreshed()).toBe(0);
  });
});
