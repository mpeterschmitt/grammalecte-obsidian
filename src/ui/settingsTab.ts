import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type GrammalectePlugin from "../main";
import { ServerProvider } from "../providers";
import { serverUrl, type ProviderId } from "../settings";
import { installEngine, isEngineInstalled, removeEngine } from "../engine/installer";

export class GrammalecteSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: GrammalectePlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Grammar checker")
			.setDesc("Where the text is analysed.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("local", "Local Grammalecte server")
					.addOption("remote", "Remote Grammalecte server")
					.addOption("js", "Bundled engine (offline, works on mobile)")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value as ProviderId;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.provider === "local") {
			this.serverSetting(
				"Server URL",
				"Address of the grammalecte-server.py instance running on this machine.",
				"localServerUrl",
			);
		} else if (this.plugin.settings.provider === "remote") {
			this.serverSetting(
				"Server URL",
				"Address of a Grammalecte server you trust. Your note text is sent to it.",
				"remoteServerUrl",
			);
		} else {
			this.engineSettings();
		}

		new Setting(containerEl).setName("Checking").setHeading();

		new Setting(containerEl)
			.setName("Check as you type")
			.setDesc("Re-check the note shortly after you stop typing.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.checkAsYouType).onChange(async (value) => {
					this.plugin.settings.checkAsYouType = value;
					await this.plugin.saveSettings(false);
				}),
			);

		new Setting(containerEl)
			.setName("Typing delay")
			.setDesc("How long to wait after the last keystroke, in milliseconds.")
			.addSlider((slider) =>
				slider
					.setLimits(300, 5000, 100)
					.setValue(this.plugin.settings.debounceMs)
					.onChange(async (value) => {
						this.plugin.settings.debounceMs = value;
						await this.plugin.saveSettings(false);
					}),
			);

		new Setting(containerEl)
			.setName("Grammar mistakes")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.checkGrammar).onChange(async (value) => {
					this.plugin.settings.checkGrammar = value;
					await this.plugin.saveSettings(false);
				}),
			);

		new Setting(containerEl)
			.setName("Spelling mistakes")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.checkSpelling).onChange(async (value) => {
					this.plugin.settings.checkSpelling = value;
					await this.plugin.saveSettings(false);
				}),
			);

		new Setting(containerEl)
			.setName("Ignore Markdown syntax")
			.setDesc("Blank out code, math, link targets and frontmatter before checking.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.ignoreMarkdownSyntax).onChange(async (value) => {
					this.plugin.settings.ignoreMarkdownSyntax = value;
					await this.plugin.saveSettings(false);
				}),
			);

		new Setting(containerEl)
			.setName("Maximum note length")
			.setDesc("Characters checked in a single pass; longer notes are checked up to this limit.")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.maxTextLength))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isFinite(parsed) && parsed > 0) {
							this.plugin.settings.maxTextLength = parsed;
							await this.plugin.saveSettings(false);
						}
					}),
			);

		this.exceptions();
	}

	private serverSetting(name: string, desc: string, key: "localServerUrl" | "remoteServerUrl"): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:8080")
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value.trim();
						await this.plugin.saveSettings();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Test")
					.onClick(async () => {
						const url = serverUrl(this.plugin.settings);
						button.setDisabled(true);
						try {
							const version = await new ServerProvider(url, this.plugin.settings.provider === "remote" ? "remote" : "local").version();
							new Notice(`Grammalecte ${version} reachable at ${url}.`);
						} catch (error) {
							new Notice(`Grammalecte: ${error instanceof Error ? error.message : String(error)}`, 8000);
						} finally {
							button.setDisabled(false);
						}
					}),
			);

		if (key === "localServerUrl") {
			const help = this.containerEl.createEl("p", { cls: "setting-item-description grammalecte-help" });
			help.setText(
				"Start the server with: python3 grammalecte-server.py -p 8080 (from the Grammalecte Python package).",
			);
		}
	}

	private engineSettings(): void {
		const setting = new Setting(this.containerEl)
			.setName("Grammalecte engine")
			.setDesc("Downloads the official JavaScript engine (~9 MB) into the plugin folder. Checked entirely on your device.");

		const status = this.containerEl.createEl("p", { cls: "setting-item-description grammalecte-help" });
		const refreshStatus = async () => {
			status.setText((await isEngineInstalled(this.plugin)) ? "Engine installed." : "Engine not installed yet.");
		};
		void refreshStatus();

		setting.addButton((button) =>
			button
				.setButtonText("Install / update")
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					const notice = new Notice("Grammalecte: starting…", 0);
					try {
						await installEngine(this.plugin, (message) => notice.setMessage(`Grammalecte: ${message}`));
						this.plugin.checker.reload();
						notice.setMessage("Grammalecte: engine installed.");
					} catch (error) {
						notice.setMessage(`Grammalecte: ${error instanceof Error ? error.message : String(error)}`);
					} finally {
						window.setTimeout(() => notice.hide(), 5000);
						button.setDisabled(false);
						await refreshStatus();
					}
				}),
		);
		setting.addButton((button) =>
			button.setButtonText("Remove").onClick(async () => {
				await removeEngine(this.plugin);
				this.plugin.checker.reload();
				new Notice("Grammalecte: engine removed.");
				await refreshStatus();
			}),
		);
	}

	private exceptions(): void {
		const { containerEl } = this;
		new Setting(containerEl).setName("Exceptions").setHeading();

		this.listSetting(
			"Personal dictionary",
			"Words that are never reported as misspelled.",
			this.plugin.settings.ignoredWords,
		);
		this.listSetting(
			"Ignored rules",
			"Grammalecte rule identifiers that are never reported.",
			this.plugin.settings.ignoredRules,
		);
	}

	private listSetting(name: string, desc: string, values: string[]): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addTextArea((area) =>
				area
					.setPlaceholder("One entry per line")
					.setValue(values.join("\n"))
					.onChange(async (value) => {
						values.length = 0;
						values.push(...value.split("\n").map((line) => line.trim()).filter(Boolean));
						await this.plugin.saveSettings(false);
					}),
			);
	}
}
