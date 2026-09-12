import { MarkdownView, Notice, Plugin } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { Checker } from "./checker";
import { createCheckerExtension } from "./editor/extension";
import { DEFAULT_SETTINGS, type GrammalecteSettings } from "./settings";
import { GrammalecteSettingTab } from "./ui/settingsTab";

export default class GrammalectePlugin extends Plugin {
	settings: GrammalecteSettings = { ...DEFAULT_SETTINGS };
	checker!: Checker;
	private statusBar: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.checker = new Checker(this);
		this.registerEditorExtension(createCheckerExtension(this));
		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("grammalecte-status");
		this.setStatus(null);

		this.addRibbonIcon("spell-check", "Check grammar (Grammalecte)", () => void this.checkActiveNote());

		this.addCommand({
			id: "check-note",
			name: "Check the current note",
			editorCallback: () => void this.checkActiveNote(),
		});
		this.addCommand({
			id: "clear-highlights",
			name: "Clear highlights",
			editorCallback: () => {
				const view = this.activeEditorView();
				if (view) this.checker.clearView(view);
			},
		});
		this.addCommand({
			id: "toggle-check-as-you-type",
			name: "Toggle checking as you type",
			callback: async () => {
				this.settings.checkAsYouType = !this.settings.checkAsYouType;
				await this.saveSettings();
				new Notice(
					this.settings.checkAsYouType
						? "Grammalecte: checking as you type."
						: "Grammalecte: checking on demand only.",
				);
			},
		});

		this.addSettingTab(new GrammalecteSettingTab(this.app, this));
	}

	onunload(): void {
		this.checker.unload();
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<GrammalecteSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	/** Persists settings, rebuilds the provider and refreshes every open editor. */
	async saveSettings(rebuildProvider = true): Promise<void> {
		await this.saveData(this.settings);
		if (rebuildProvider) this.checker.reload();
		this.refreshOpenEditors();
	}

	private refreshOpenEditors(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;
			const view = editorViewOf(leaf.view);
			if (!view) return;
			if (this.settings.checkAsYouType) void this.checker.checkView(view);
			else this.checker.clearView(view);
		});
	}

	activeEditorView(): EditorView | null {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		return markdownView ? editorViewOf(markdownView) : null;
	}

	async checkActiveNote(): Promise<void> {
		const view = this.activeEditorView();
		if (!view) {
			new Notice("Grammalecte: open a note in edit mode first.");
			return;
		}
		this.setStatus(null, false, undefined, true);
		await this.checker.checkView(view, true);
	}

	async addIgnoredWord(word: string): Promise<void> {
		if (this.settings.ignoredWords.includes(word)) return;
		this.settings.ignoredWords.push(word);
		await this.saveSettings(false);
	}

	async addIgnoredRule(ruleId: string): Promise<void> {
		if (this.settings.ignoredRules.includes(ruleId)) return;
		this.settings.ignoredRules.push(ruleId);
		await this.saveSettings(false);
	}

	/** Updates the status bar: issue count, error message, or idle. */
	setStatus(count: number | null, truncated = false, error?: string, checking = false): void {
		if (!this.statusBar) return;
		if (checking) {
			this.statusBar.setText("Grammalecte: checking…");
			return;
		}
		if (error) {
			this.statusBar.setText("Grammalecte: error");
			this.statusBar.setAttr("aria-label", error);
			return;
		}
		this.statusBar.removeAttribute("aria-label");
		if (count === null) {
			this.statusBar.setText("Grammalecte");
			return;
		}
		const suffix = truncated ? " (partial)" : "";
		this.statusBar.setText(count === 0 ? "Grammalecte: no issue" : `Grammalecte: ${count}${suffix}`);
	}
}

/** Obsidian exposes the underlying CodeMirror 6 view as `editor.cm`. */
function editorViewOf(markdownView: MarkdownView): EditorView | null {
	const cm = (markdownView.editor as unknown as { cm?: EditorView }).cm;
	return cm ?? null;
}
