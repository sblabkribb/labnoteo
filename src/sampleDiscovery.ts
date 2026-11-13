import type LabnotePlugin from './main';
import { getSampleDisplayMeta } from '@labnoteo/core/lib/sampleUtils';
import { listExperimentSampleFolders } from '@labnoteo/core/lib/sampleStorage';
import { partitionCustomSampleTypes } from './settings';

/** Inspect only configured registries. Discovery never migrates or rewrites a ledger. */
export async function discoverSampleTypes(plugin: LabnotePlugin): Promise<void> {
  const known = getSampleDisplayMeta(plugin.settings.customSampleTypes).types;
  const folders = [...new Set([plugin.settings.globalSampleFolder, ...await listExperimentSampleFolders(plugin.fs, '')].filter(Boolean))];
  const candidates = new Map<string, { paths: string[]; count: number }>();
  const problems: string[] = [];
  for (const folder of folders) {
    for (const name of await plugin.fs.list(folder)) {
      if (!name.endsWith('.json')) continue;
      const type = name.slice(0, -5);
      if (known.includes(type)) continue;
      const file = `${folder}/${name}`;
      try {
        const raw: unknown = JSON.parse(await plugin.fs.read(file));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(file); continue; }
        const rows = Object.values(raw);
        if (!rows.length) continue;
        // A catalog has a filename suffix, but records belong to its base type.
        const catalog = known.some(k => type.startsWith(`${k}_`) && Object.entries(raw).every(([id, r]) => r && typeof r === 'object' && ((r as { type?: unknown }).type === k || ((r as { type?: unknown }).type === undefined && id.startsWith(`${k}-`)))));
        if (catalog) continue;
        const valid = rows.every(r => r && typeof r === 'object' && !Array.isArray(r) && ((r as { type?: unknown }).type === undefined || (r as { type?: unknown }).type === type));
        const checked = partitionCustomSampleTypes([...plugin.settings.customSampleTypes, type].join(','), plugin.settings.customSampleTypes);
        if (!valid || !checked.save.includes(type)) { problems.push(file); continue; }
        const entry = candidates.get(type) ?? { paths: [], count: 0 };
        entry.paths.push(file); entry.count += rows.length; candidates.set(type, entry);
      } catch { problems.push(file); }
    }
  }
  for (const [type, info] of [...candidates]) {
    if ([...candidates.keys()].some(other => other !== type && other.toLowerCase() === type.toLowerCase())) {
      problems.push(...info.paths);
    }
  }
  for (const [type, info] of candidates) if (info.paths.some(file => problems.includes(file))) candidates.delete(type);
  if (problems.length) plugin.host.notify('warn', plugin.t('Sample registries need attention (invalid JSON, type mismatch or conflicting type name): {0}', problems.join(', ')));
  if (!candidates.size) return;
  const choices = [...candidates].map(([value, info]) => ({ value, label: value, description: `${info.count}: ${info.paths.join(', ')}` }));
  const types = await plugin.host.pickMany(choices, { title: plugin.t('Register sample types found in this vault') });
  if (!types.length) return;
  plugin.settings.customSampleTypes = partitionCustomSampleTypes([...plugin.settings.customSampleTypes, ...types].join(','), plugin.settings.customSampleTypes).save;
  await plugin.saveSettings();
  plugin.refreshSampleViews();
}
