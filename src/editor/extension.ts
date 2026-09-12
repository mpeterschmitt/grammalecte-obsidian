import { Decoration, EditorView, ViewPlugin, type DecorationSet, type PluginValue, type ViewUpdate } from "@codemirror/view";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import type GrammalectePlugin from "../main";
import type { Issue } from "../types";
import { showIssueMenu } from "./menu";

export const setIssuesEffect = StateEffect.define<Issue[]>();
export const clearIssuesEffect = StateEffect.define<null>();

interface IssueSpec {
	class: string;
	issue: Issue;
}

function decorationFor(issue: Issue): Decoration {
	return Decoration.mark({
		class: `grammalecte-issue grammalecte-issue-${issue.kind}`,
		attributes: { "aria-label": issue.message },
		issue,
	});
}

export const issuesField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(decorations, transaction) {
		let next = decorations.map(transaction.changes);
		for (const effect of transaction.effects) {
			if (effect.is(clearIssuesEffect)) {
				next = Decoration.none;
			} else if (effect.is(setIssuesEffect)) {
				const docLength = transaction.state.doc.length;
				const ranges = effect.value
					.filter((issue) => issue.from < issue.to && issue.to <= docLength)
					.map((issue) => decorationFor(issue).range(issue.from, issue.to));
				next = Decoration.set(ranges, true);
			}
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field),
});

/** Returns the issue decorating `pos`, with its up-to-date offsets. */
export function issueAt(view: EditorView, pos: number): Issue | null {
	let found: Issue | null = null;
	view.state.field(issuesField).between(pos, pos, (from, to, decoration) => {
		const spec = decoration.spec as IssueSpec;
		if (!spec.issue) return;
		found = { ...spec.issue, from, to };
		return false;
	});
	return found;
}

function checkerViewPlugin(plugin: GrammalectePlugin) {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			private timer: number | null = null;

			constructor(private readonly view: EditorView) {
				this.schedule(50);
			}

			update(update: ViewUpdate): void {
				if (!update.docChanged) return;
				if (!plugin.settings.checkAsYouType) return;
				this.schedule(plugin.settings.debounceMs);
			}

			private schedule(delay: number): void {
				if (!plugin.settings.checkAsYouType) return;
				this.cancel();
				this.timer = window.setTimeout(() => {
					this.timer = null;
					void plugin.checker.checkView(this.view);
				}, delay);
			}

			private cancel(): void {
				if (this.timer !== null) {
					window.clearTimeout(this.timer);
					this.timer = null;
				}
			}

			destroy(): void {
				this.cancel();
			}
		},
	);
}

function clickHandler(plugin: GrammalectePlugin): Extension {
	return EditorView.domEventHandlers({
		click: (event, view) => {
			const target = event.target as HTMLElement | null;
			if (!target?.closest(".grammalecte-issue")) return false;
			const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.posAtDOM(target);
			const issue = issueAt(view, pos) ?? issueAt(view, pos + 1);
			if (!issue) return false;
			event.preventDefault();
			void showIssueMenu(plugin, view, issue, event);
			return true;
		},
	});
}

export function createCheckerExtension(plugin: GrammalectePlugin): Extension[] {
	return [issuesField, checkerViewPlugin(plugin), clickHandler(plugin)];
}
