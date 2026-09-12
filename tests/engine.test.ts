import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENGINE_DATA, ENGINE_SCRIPTS } from "../src/engine/files";
import { ENGINE_GLUE } from "../src/engine/glue";
import type { RawGrammarError, RawSpellingError } from "../src/types";

interface EngineApi {
	init(data: Record<string, string>): string;
	check(
		text: string,
		options: { grammar: boolean; spelling: boolean; gcOptions: Record<string, boolean> },
	): { offset: number; grammar: RawGrammarError[]; spelling: RawSpellingError[] }[];
	suggest(word: string): string[];
}

const engineDir = new URL("../engine/", import.meta.url);
const installed = ENGINE_SCRIPTS.every((file) => existsSync(new URL(file, engineDir)));

function loadEngine(): EngineApi {
	const sources = ENGINE_SCRIPTS.map((file) => readFileSync(new URL(file, engineDir), "utf8"));
	const body = [...sources, ENGINE_GLUE].join("\n;\n");
	const data: Record<string, string> = {};
	for (const file of ENGINE_DATA) {
		data[file.split("/").pop()!] = readFileSync(new URL(file, engineDir), "utf8");
	}
	// Same call shape as the worker bootstrap in src/engine/glue.ts.
	const api = new Function("process", "require", "self", body)(
		undefined,
		undefined,
		globalThis,
	) as EngineApi;
	api.init(data);
	return api;
}

// The engine is downloaded at runtime, so these run only where it is installed.
describe.skipIf(!installed)("bundled engine", () => {
	const api = installed ? loadEngine() : (null as unknown as EngineApi);
	const options = { grammar: true, spelling: true, gcOptions: {} };

	it("reports grammar errors with paragraph-relative offsets", () => {
		const text = "Bonjour.\nJ'en aie mare de luii.";
		const results = api.check(text, options);
		expect(results).toHaveLength(1);
		const paragraph = results[0]!;
		expect(paragraph.offset).toBe(9);
		const rules = paragraph.grammar.map((error) => error.sRuleId);
		expect(rules.some((rule) => rule.includes("vmode"))).toBe(true);
		const marre = paragraph.grammar.find((error) => error.aSuggestions.includes("marre"));
		expect(marre).toBeDefined();
		expect(text.slice(paragraph.offset + marre!.nStart, paragraph.offset + marre!.nEnd)).toBe("mare");
	});

	it("reports unknown words", () => {
		const results = api.check("Un mott inexistanttt ici.", options);
		const spelling = results[0]!.spelling.map((error) => error.sValue);
		expect(spelling).toContain("mott");
		expect(spelling).toContain("inexistanttt");
	});

	it("suggests corrections for a misspelled word", () => {
		expect(api.suggest("mott")).toContain("mot");
	});

	it("honours disabled rule options", () => {
		const withApos = api.check("J'en ai marre.", options);
		expect(withApos[0]?.grammar.some((error) => error.sType === "apos")).toBe(true);
		const withoutApos = api.check("J'en ai marre.", { ...options, gcOptions: { apos: false } });
		expect(withoutApos.some((paragraph) => paragraph.grammar.some((error) => error.sType === "apos"))).toBe(false);
	});

	it("skips checks that are turned off", () => {
		const results = api.check("Un mott inexistanttt.", { ...options, spelling: false });
		expect(results.every((paragraph) => paragraph.spelling.length === 0)).toBe(true);
	});
});
