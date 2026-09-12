export type IssueKind = "grammar" | "spelling";

/** A grammar or spelling issue, with offsets relative to the checked text. */
export interface Issue {
	from: number;
	to: number;
	kind: IssueKind;
	message: string;
	suggestions: string[];
	ruleId: string;
	word: string;
	url?: string;
}

/** Raw grammar error as returned by Grammalecte (server and JS engine share this shape). */
export interface RawGrammarError {
	nStart: number;
	nEnd: number;
	sLineId: string;
	sRuleId: string;
	sType: string;
	sMessage: string;
	aSuggestions: string[];
	URL?: string;
}

/** Raw spelling error as returned by Grammalecte. */
export interface RawSpellingError {
	nStart: number;
	nEnd: number;
	sValue: string;
	sType: string;
}

export interface CheckOptions {
	grammar: boolean;
	spelling: boolean;
	/** Grammalecte rule options, e.g. `{ "apos": false }`. */
	gcOptions: Record<string, boolean>;
}

export interface Provider {
	readonly id: string;
	/** Human readable description, shown in settings and errors. */
	describe(): string;
	/** Make the provider usable; throws with a readable message when it cannot be. */
	load(): Promise<void>;
	unload(): void;
	/** Check a whole text; returned offsets are absolute within `text`. */
	check(text: string, options: CheckOptions): Promise<Issue[]>;
	/** Spelling suggestions for a single word. */
	suggest(word: string): Promise<string[]>;
}

/** Split into paragraphs the same way Grammalecte does (one per `\n`). */
export function paragraphOffsets(text: string): { start: number; text: string }[] {
	const out: { start: number; text: string }[] = [];
	let start = 0;
	for (const part of text.split("\n")) {
		out.push({ start, text: part });
		start += part.length + 1;
	}
	return out;
}

export function toIssue(
	err: RawGrammarError | RawSpellingError,
	offset: number,
	kind: IssueKind,
	text: string,
): Issue {
	const from = offset + err.nStart;
	const to = offset + err.nEnd;
	if (kind === "grammar") {
		const e = err as RawGrammarError;
		return {
			from,
			to,
			kind,
			message: e.sMessage,
			suggestions: e.aSuggestions ?? [],
			ruleId: e.sRuleId,
			word: text.slice(from, to),
			url: e.URL || undefined,
		};
	}
	const e = err as RawSpellingError;
	return {
		from,
		to,
		kind,
		message: `Mot inconnu : ${e.sValue}`,
		suggestions: [],
		ruleId: "spelling",
		word: e.sValue,
	};
}
