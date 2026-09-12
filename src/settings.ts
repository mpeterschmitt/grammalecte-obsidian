export type ProviderId = "local" | "remote" | "js";

export interface GrammalecteSettings {
	provider: ProviderId;
	localServerUrl: string;
	remoteServerUrl: string;
	checkAsYouType: boolean;
	debounceMs: number;
	checkGrammar: boolean;
	checkSpelling: boolean;
	/** Blank out code, math, links and frontmatter before checking. */
	ignoreMarkdownSyntax: boolean;
	/** Grammalecte rule options, e.g. `{ "apos": false }`. */
	gcOptions: Record<string, boolean>;
	/** Rule ids the user chose never to see again. */
	ignoredRules: string[];
	/** Words the user added to their personal dictionary. */
	ignoredWords: string[];
	/** Max characters sent in a single check. */
	maxTextLength: number;
}

export const DEFAULT_SETTINGS: GrammalecteSettings = {
	provider: "local",
	localServerUrl: "http://localhost:8080",
	remoteServerUrl: "",
	checkAsYouType: true,
	debounceMs: 1200,
	checkGrammar: true,
	checkSpelling: true,
	ignoreMarkdownSyntax: true,
	gcOptions: {},
	ignoredRules: [],
	ignoredWords: [],
	maxTextLength: 60000,
};

export function serverUrl(settings: GrammalecteSettings): string {
	const url = settings.provider === "remote" ? settings.remoteServerUrl : settings.localServerUrl;
	return url.replace(/\/+$/, "");
}
