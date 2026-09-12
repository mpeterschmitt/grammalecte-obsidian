import { Notice } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { clearIssuesEffect, setIssuesEffect } from "./editor/extension";
import { maskMarkdown } from "./markdown";
import { createProvider } from "./providers";
import type GrammalectePlugin from "./main";
import type { Issue, Provider } from "./types";

const ERROR_NOTICE_INTERVAL = 30_000;

/** Owns the active provider and turns editor content into decorated issues. */
export class Checker {
	private provider: Provider | null = null;
	private lastErrorAt = 0;
	private running = new WeakMap<EditorView, Promise<void>>();

	constructor(private readonly plugin: GrammalectePlugin) {}

	/** Drops the current provider so the next check picks up new settings. */
	reload(): void {
		this.provider?.unload();
		this.provider = null;
	}

	unload(): void {
		this.reload();
	}

	getProvider(): Provider {
		this.provider ??= createProvider(this.plugin, this.plugin.settings);
		return this.provider;
	}

	private get settings() {
		return this.plugin.settings;
	}

	async check(text: string): Promise<Issue[]> {
		const provider = this.getProvider();
		const source = this.settings.ignoreMarkdownSyntax ? maskMarkdown(text) : text;
		const issues = await provider.check(source, {
			grammar: this.settings.checkGrammar,
			spelling: this.settings.checkSpelling,
			gcOptions: this.settings.gcOptions,
		});
		const ignoredWords = new Set(this.settings.ignoredWords.map((word) => word.toLowerCase()));
		const ignoredRules = new Set(this.settings.ignoredRules);
		return issues.filter(
			(issue) => !ignoredRules.has(issue.ruleId) && !ignoredWords.has(issue.word.toLowerCase()),
		);
	}

	/** Checks the document shown in `view` and paints the result. */
	async checkView(view: EditorView, notifyErrors = false): Promise<void> {
		const inFlight = this.running.get(view);
		if (inFlight) await inFlight.catch(() => {});
		const run = this.doCheckView(view, notifyErrors);
		this.running.set(view, run);
		try {
			await run;
		} finally {
			if (this.running.get(view) === run) this.running.delete(view);
		}
	}

	private async doCheckView(view: EditorView, notifyErrors: boolean): Promise<void> {
		const text = view.state.doc.toString();
		if (text.length === 0) {
			view.dispatch({ effects: clearIssuesEffect.of(null) });
			this.plugin.setStatus(0);
			return;
		}
		const truncated = text.length > this.settings.maxTextLength;
		const source = truncated ? text.slice(0, this.settings.maxTextLength) : text;
		try {
			const issues = await this.check(source);
			// The document may have changed while we were waiting; offsets would be stale.
			if (view.state.doc.toString() !== text) return;
			view.dispatch({ effects: setIssuesEffect.of(issues) });
			this.plugin.setStatus(issues.length, truncated);
		} catch (error) {
			this.reportError(error, notifyErrors);
		}
	}

	clearView(view: EditorView): void {
		view.dispatch({ effects: clearIssuesEffect.of(null) });
		this.plugin.setStatus(null);
	}

	async suggest(word: string): Promise<string[]> {
		try {
			return await this.getProvider().suggest(word);
		} catch (error) {
			this.reportError(error, false);
			return [];
		}
	}

	private reportError(error: unknown, force: boolean): void {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Grammalecte:", error);
		this.plugin.setStatus(null, false, message);
		const now = Date.now();
		if (!force && now - this.lastErrorAt < ERROR_NOTICE_INTERVAL) return;
		this.lastErrorAt = now;
		new Notice(`Grammalecte: ${message}`, 8000);
	}
}
