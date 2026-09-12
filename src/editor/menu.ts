import { Menu, Notice, Platform } from "obsidian";
import type { EditorView } from "@codemirror/view";
import type GrammalectePlugin from "../main";
import type { Issue } from "../types";

function applySuggestion(view: EditorView, issue: Issue, replacement: string): void {
	view.dispatch({
		changes: { from: issue.from, to: issue.to, insert: replacement },
		selection: { anchor: issue.from + replacement.length },
	});
	view.focus();
}

/** Opens the correction menu for an issue, fetching spelling suggestions if needed. */
export async function showIssueMenu(
	plugin: GrammalectePlugin,
	view: EditorView,
	issue: Issue,
	event: MouseEvent,
): Promise<void> {
	let suggestions = issue.suggestions;
	if (issue.kind === "spelling" && suggestions.length === 0) {
		suggestions = await plugin.checker.suggest(issue.word);
	}

	const menu = new Menu();
	menu.addItem((item) => item.setTitle(issue.message).setIcon("spell-check").setDisabled(true));
	if (suggestions.length > 0) {
		menu.addSeparator();
		for (const suggestion of suggestions.slice(0, 10)) {
			menu.addItem((item) =>
				item.setTitle(suggestion).onClick(() => applySuggestion(view, issue, suggestion)),
			);
		}
	} else {
		menu.addItem((item) => item.setTitle("No suggestion").setDisabled(true));
	}

	menu.addSeparator();
	if (issue.kind === "spelling") {
		menu.addItem((item) =>
			item
				.setTitle("Add to personal dictionary")
				.setIcon("book-plus")
				.onClick(async () => {
					await plugin.addIgnoredWord(issue.word);
					new Notice(`“${issue.word}” added to your dictionary.`);
				}),
		);
	} else {
		menu.addItem((item) =>
			item
				.setTitle("Ignore this rule")
				.setIcon("ban")
				.onClick(async () => {
					await plugin.addIgnoredRule(issue.ruleId);
					new Notice(`Rule ${issue.ruleId} ignored.`);
				}),
		);
	}
	if (issue.url) {
		const url = issue.url;
		menu.addItem((item) =>
			item
				.setTitle("Learn more")
				.setIcon("external-link")
				.onClick(() => window.open(url, "_blank")),
		);
	}

	if (Platform.isMobile) {
		menu.showAtPosition({ x: event.clientX, y: event.clientY });
	} else {
		menu.showAtMouseEvent(event);
	}
}
