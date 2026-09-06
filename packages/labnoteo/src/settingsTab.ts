/**
 * Settings tab for the Labnote Assistant plugin.
 *
 * Sample options mirror the companion VS Code extension's settings; the LLM section is
 * Obsidian-specific (the desktop build talks to Ollama/OpenAI directly).
 */
import { App, PluginSettingTab, Setting } from 'obsidian';
import type LabnotePlugin from './main';
import type { LlmProviderKind } from './settings';

export class LabnoteSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: LabnotePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const s = this.plugin.settings;
    const save = () => void this.plugin.saveSettings();

    containerEl.createEl('h3', { text: this.plugin.t('Samples') });

    new Setting(containerEl)
      .setName(this.plugin.t('Sample tracking'))
      .setDesc(this.plugin.t('Autocomplete, highlighting and {Type}.json sync. Reload to apply.'))
      .addToggle(t =>
        t.setValue(s.sampleTracking).onChange(v => {
          s.sampleTracking = v;
          save();
        })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('Custom sample types'))
      .setDesc(this.plugin.t('Comma-separated types in addition to the built-ins.'))
      .addText(t =>
        t
          .setPlaceholder('CellLine, Strain')
          .setValue(s.customSampleTypes.join(', '))
          .onChange(v => {
            s.customSampleTypes = v
              .split(',')
              .map(x => x.trim())
              .filter(Boolean);
            save();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('Global sample folder'))
      .setDesc(this.plugin.t('Vault-relative folder for vault-global samples.'))
      .addText(t =>
        t.setValue(s.globalSampleFolder).onChange(v => {
          s.globalSampleFolder = v.trim();
          save();
        })
      );

    containerEl.createEl('h3', { text: this.plugin.t('AI provider') });

    new Setting(containerEl)
      .setName(this.plugin.t('Provider'))
      .addDropdown(d =>
        d
          .addOption('none', this.plugin.t('Disabled'))
          .addOption('ollama', 'Ollama')
          .addOption('openai', 'OpenAI-compatible')
          .setValue(s.llmProvider)
          .onChange(v => {
            s.llmProvider = v as LlmProviderKind;
            save();
          })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('Endpoint'))
      .addText(t =>
        t.setValue(s.llmEndpoint).onChange(v => {
          s.llmEndpoint = v.trim();
          save();
        })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('Model'))
      .addText(t =>
        t.setValue(s.llmModel).onChange(v => {
          s.llmModel = v.trim();
          save();
        })
      );

    new Setting(containerEl)
      .setName(this.plugin.t('API key'))
      .setDesc(this.plugin.t('Only sent to OpenAI-compatible providers, never to Ollama.'))
      .addText(t => {
        t.inputEl.type = 'password';
        t.setValue(s.llmApiKey).onChange(v => {
          s.llmApiKey = v;
          save();
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t('Enable MCP server'))
      .setDesc(this.plugin.t('Desktop only. Exposes tools to external MCP clients.'))
      .addToggle(t =>
        t.setValue(s.mcpEnabled).onChange(v => {
          s.mcpEnabled = v;
          save();
        })
      );
  }
}
