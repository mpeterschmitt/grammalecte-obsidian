import { describe, expect, it } from "vitest";
import { maskMarkdown } from "../src/markdown";

function assertSameLength(source: string): string {
	const masked = maskMarkdown(source);
	expect(masked).toHaveLength(source.length);
	return masked;
}

describe("maskMarkdown", () => {
	it("keeps offsets intact", () => {
		const source = "# Titre\n\nUn **texte** avec `du code` et [un lien](https://exemple.fr).\n";
		assertSameLength(source);
	});

	it("blanks fenced code blocks", () => {
		const source = "Avant.\n\n```js\nconst x = 1;\n```\n\nAprès.";
		const masked = assertSameLength(source);
		expect(masked).not.toContain("const x");
		expect(masked).toContain("Avant.");
		expect(masked).toContain("Après.");
	});

	it("blanks inline code and math but keeps the prose around them", () => {
		const source = "Voici `un_appel()` et $x^2$ dans la phrase.";
		const masked = assertSameLength(source);
		expect(masked).not.toContain("un_appel");
		expect(masked).not.toContain("x^2");
		expect(masked).toContain("Voici");
		expect(masked).toContain("dans la phrase.");
	});

	it("keeps the visible part of links at the right offset", () => {
		const source = "Voir [ma note](https://exemple.fr/page) et [[dossier/cible|mon alias]].";
		const masked = assertSameLength(source);
		expect(masked).toContain("ma note");
		expect(masked).toContain("mon alias");
		expect(masked).not.toContain("exemple.fr");
		expect(masked).not.toContain("dossier/cible");
	});

	it("blanks frontmatter", () => {
		const source = "---\ntitle: Essai\ntags: [un, deux]\n---\nLe texte.";
		const masked = assertSameLength(source);
		expect(masked.trim()).toBe("Le texte.");
	});
});
