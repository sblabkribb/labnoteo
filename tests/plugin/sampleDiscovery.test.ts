import { describe, it, expect, vi } from 'vitest';
import { MemFileSystem } from '../../packages/labnoteo-core/src/fs/memFileSystem';
import { discoverSampleTypes } from '../../src/sampleDiscovery';
import type LabnotePlugin from '../../src/main';

function fixture(files: Record<string, string>, selection: string[]) {
  const fs = new MemFileSystem(files);
  const pickMany = vi.fn().mockResolvedValue(selection);
  const plugin = { fs, settings: { globalSampleFolder: 'resources/labsamples', customSampleTypes: [] as string[] },
    host: { pickMany, notify: vi.fn() }, t: (s: string) => s,
    saveSettings: vi.fn(), refreshSampleViews: vi.fn() } as unknown as LabnotePlugin;
  return { fs, plugin, pickMany };
}

describe('sample type discovery', () => {
  it('offers a legacy custom registry, excludes catalogs, and registers only the selection without rewriting data', async () => {
    const files = {
      'resources/labsamples/Strain.json': '{"Strain-1":{"alias":"lab strain"}}',
      'resources/labsamples/Reagent_vendor.json': '{"Reagent-1":{"alias":"catalog"}}',
      'resources/labsamples/Broken.json': '{',
    };
    const { fs, plugin, pickMany } = fixture(files, ['Strain']);
    const before = fs.snapshot();
    await discoverSampleTypes(plugin);
    expect(pickMany.mock.calls[0][0].map((x: { value: string }) => x.value)).toEqual(['Strain']);
    expect(plugin.settings.customSampleTypes).toEqual(['Strain']);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(fs.snapshot()).toEqual(before);
  });
  it('keeps registries and settings untouched after cancellation', async () => {
    const { fs, plugin } = fixture({ 'resources/labsamples/Strain.json': '{"Strain-1":{}}' }, []);
    const before = fs.snapshot();
    await discoverSampleTypes(plugin);
    expect(plugin.settings.customSampleTypes).toEqual([]);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
    expect(fs.snapshot()).toEqual(before);
  });
  it('reports discovered type names differing only in case instead of offering both', async () => {
    const { plugin, pickMany } = fixture({
      'resources/labsamples/Strain.json': '{"Strain-1":{}}',
      'resources/labsamples/strain.json': '{"strain-2":{}}',
    }, []);
    await discoverSampleTypes(plugin);
    expect(pickMany).not.toHaveBeenCalled();
    expect(plugin.host.notify).toHaveBeenCalled();
  });
});
