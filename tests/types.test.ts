import { describe, expect, it } from "vitest";
import { paragraphOffsets, toIssue } from "../src/types";

describe("paragraphOffsets", () => {
	it("matches Grammalecte's paragraph splitting", () => {
		const text = "Une ligne.\nUne autre.\n\nLa dernière.";
		const paragraphs = paragraphOffsets(text);
		expect(paragraphs).toHaveLength(4);
		expect(paragraphs[1]).toEqual({ start: 11, text: "Une autre." });
		expect(text.slice(paragraphs[3]!.start)).toBe("La dernière.");
	});
});

describe("toIssue", () => {
	const text = "Une ligne.\nJ'en aie mare.";

	it("shifts grammar offsets into the document", () => {
		const issue = toIssue(
			{
				nStart: 5,
				nEnd: 8,
				sLineId: "#1",
				sRuleId: "vmode",
				sType: "vmode",
				sMessage: "Mauvais mode.",
				aSuggestions: ["ai"],
			},
			11,
			"grammar",
			text,
		);
		expect([issue.from, issue.to]).toEqual([16, 19]);
		expect(text.slice(issue.from, issue.to)).toBe("aie");
		expect(issue.suggestions).toEqual(["ai"]);
	});

	it("uses the reported word for spelling issues", () => {
		const issue = toIssue(
			{ nStart: 9, nEnd: 13, sValue: "mare", sType: "WORD" },
			11,
			"spelling",
			text,
		);
		expect(issue.word).toBe("mare");
		expect(issue.suggestions).toEqual([]);
	});
});
