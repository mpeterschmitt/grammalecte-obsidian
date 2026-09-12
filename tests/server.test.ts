import { describe, expect, it } from "vitest";
import { ServerProvider } from "../src/providers/server";

const SERVER_URL = process.env.GRAMMALECTE_SERVER ?? "http://localhost:8080";
const options = { grammar: true, spelling: true, gcOptions: {} };

async function isReachable(): Promise<boolean> {
	try {
		await new ServerProvider(SERVER_URL, "local").version();
		return true;
	} catch {
		return false;
	}
}

// These need a Grammalecte server; start one with `python3 grammalecte-server.py -p 8080`,
// or point GRAMMALECTE_SERVER at another instance.
const reachable = await isReachable();

describe.skipIf(!reachable)("ServerProvider", () => {
	const provider = new ServerProvider(SERVER_URL, "local");

	it("maps paragraph offsets onto the whole text", async () => {
		const text = "Bonjour.\nJ'en aie mare de luii.";
		const issues = await provider.check(text, options);
		const marre = issues.find((issue) => issue.suggestions.includes("marre"));
		expect(marre).toBeDefined();
		expect(text.slice(marre!.from, marre!.to)).toBe("mare");
		const unknown = issues.find((issue) => issue.kind === "spelling");
		expect(unknown?.word).toBe("luii");
		expect(text.slice(unknown!.from, unknown!.to)).toBe("luii");
	});

	it("honours the grammar and spelling switches", async () => {
		const text = "J'en aie mare de luii.";
		const grammarOnly = await provider.check(text, { ...options, spelling: false });
		expect(grammarOnly.every((issue) => issue.kind === "grammar")).toBe(true);
	});

	it("suggests corrections for an unknown word", async () => {
		expect(await provider.suggest("mott")).toContain("mot");
	});
});

describe("ServerProvider errors", () => {
	it("reports an unreachable server with a readable message", async () => {
		const provider = new ServerProvider("http://127.0.0.1:1", "local");
		await expect(provider.load()).rejects.toThrow(/Cannot reach|fetch failed|ECONNREFUSED/);
	});
});
