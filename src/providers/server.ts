import { requestUrl } from "obsidian";
import type { CheckOptions, Issue, Provider, RawGrammarError, RawSpellingError } from "../types";
import { paragraphOffsets, toIssue } from "../types";

interface ServerParagraph {
	iParagraph: number;
	lGrammarErrors?: RawGrammarError[];
	lSpellingErrors?: RawSpellingError[];
}

interface ServerResponse {
	program?: string;
	version?: string;
	error?: string;
	data?: ServerParagraph[];
}

function formEncode(params: Record<string, string>): string {
	return Object.entries(params)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join("&");
}

/**
 * Talks to a Grammalecte HTTP server (`grammalecte-server.py`), either on
 * localhost or on a remote instance. Uses `requestUrl` so it also works on
 * mobile and is not subject to CORS.
 */
export class ServerProvider implements Provider {
	readonly id: string;

	constructor(
		private readonly baseUrl: string,
		id: "local" | "remote",
	) {
		this.id = id;
	}

	describe(): string {
		return `Grammalecte server at ${this.baseUrl || "(no URL configured)"}`;
	}

	async load(): Promise<void> {
		if (!this.baseUrl) {
			throw new Error("No server URL configured.");
		}
		await this.version();
	}

	unload(): void {
		// Nothing to release: every request is stateless.
	}

	/** Returns the server version, and throws a readable error when unreachable. */
	async version(): Promise<string> {
		const response = await this.post("/gc_text/fr", { text: "Test." });
		return response.version ?? "unknown";
	}

	async check(text: string, options: CheckOptions): Promise<Issue[]> {
		const body: Record<string, string> = { text };
		if (Object.keys(options.gcOptions).length > 0) {
			body.options = JSON.stringify(options.gcOptions);
		}
		const response = await this.post("/gc_text/fr", body);
		if (response.error) {
			throw new Error(response.error);
		}
		const paragraphs = paragraphOffsets(text);
		const issues: Issue[] = [];
		for (const entry of response.data ?? []) {
			// `iParagraph` is 1-based and counts paragraphs split on "\n".
			const offset = paragraphs[entry.iParagraph - 1]?.start;
			if (offset === undefined) continue;
			if (options.grammar) {
				for (const err of entry.lGrammarErrors ?? []) {
					issues.push(toIssue(err, offset, "grammar", text));
				}
			}
			if (options.spelling) {
				for (const err of entry.lSpellingErrors ?? []) {
					issues.push(toIssue(err, offset, "spelling", text));
				}
			}
		}
		return issues;
	}

	async suggest(word: string): Promise<string[]> {
		const response = await this.post("/suggest/fr", { token: word });
		const suggestions = (response as unknown as { suggestions?: string[] }).suggestions;
		return suggestions ?? [];
	}

	private async post(path: string, params: Record<string, string>): Promise<ServerResponse> {
		let response;
		try {
			response = await requestUrl({
				url: `${this.baseUrl}${path}`,
				method: "POST",
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",
				body: formEncode(params),
				throw: false,
			});
		} catch (error) {
			throw new Error(`Cannot reach ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (response.status >= 400) {
			throw new Error(`${this.baseUrl} answered HTTP ${response.status}.`);
		}
		try {
			return response.json as ServerResponse;
		} catch {
			throw new Error(`${this.baseUrl} did not return JSON; is it a Grammalecte server?`);
		}
	}
}
