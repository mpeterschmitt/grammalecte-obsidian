import type { Plugin } from "obsidian";
import type { CheckOptions, Issue, Provider, RawGrammarError, RawSpellingError } from "../types";
import { toIssue } from "../types";
import { ENGINE_DATA, ENGINE_SCRIPTS } from "../engine/files";
import { enginePath, isEngineInstalled } from "../engine/installer";
import { EngineRunner } from "../engine/runner";

/**
 * Runs Grammalecte entirely inside Obsidian, using the engine files installed
 * in the plugin folder. Works offline and on mobile, at the cost of ~9 MB of
 * data loaded into memory on first use.
 */
export class JsProvider implements Provider {
	readonly id = "js";
	private runner = new EngineRunner();
	private loading: Promise<void> | null = null;

	constructor(private readonly plugin: Plugin) {}

	describe(): string {
		return `Bundled JavaScript engine ${this.runner.version}`;
	}

	load(): Promise<void> {
		this.loading ??= this.doLoad().catch((error: unknown) => {
			this.loading = null;
			throw error;
		});
		return this.loading;
	}

	private async doLoad(): Promise<void> {
		if (!(await isEngineInstalled(this.plugin))) {
			throw new Error("The Grammalecte engine is not installed. Install it from the plugin settings.");
		}
		const adapter = this.plugin.app.vault.adapter;
		const sources: string[] = [];
		for (const file of ENGINE_SCRIPTS) {
			sources.push(await adapter.read(enginePath(this.plugin, file)));
		}
		const data: Record<string, string> = {};
		for (const file of ENGINE_DATA) {
			const name = file.split("/").pop();
			if (!name) continue;
			data[name] = await adapter.read(enginePath(this.plugin, file));
		}
		await this.runner.load(sources, data);
	}

	unload(): void {
		this.runner.unload();
		this.loading = null;
	}

	async check(text: string, options: CheckOptions): Promise<Issue[]> {
		await this.load();
		const paragraphs = await this.runner.check(text, options);
		const issues: Issue[] = [];
		for (const paragraph of paragraphs) {
			for (const error of paragraph.grammar as RawGrammarError[]) {
				issues.push(toIssue(error, paragraph.offset, "grammar", text));
			}
			for (const error of paragraph.spelling as RawSpellingError[]) {
				issues.push(toIssue(error, paragraph.offset, "spelling", text));
			}
		}
		return issues;
	}

	async suggest(word: string): Promise<string[]> {
		await this.load();
		return this.runner.suggest(word);
	}
}
