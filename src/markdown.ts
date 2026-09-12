/**
 * Blank out Markdown syntax that Grammalecte would otherwise flag, replacing it
 * with spaces so every offset in the masked text still matches the original.
 */

function blank(length: number): string {
	return " ".repeat(length);
}

/** Keep `visible` where it sits inside `match`, blanking everything around it. */
function keepVisible(match: string, visible: string): string {
	const pad = match.length - visible.length;
	return blank(Math.ceil(pad / 2)) + visible + blank(Math.floor(pad / 2));
}

const BLANKED: RegExp[] = [
	/^---\n[\s\S]*?\n---\n/, // YAML frontmatter, document start only
	/^(?: {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\1[^\n]*|$)/gm, // fenced code
	/`[^`\n]+`/g, // inline code
	/\$\$[\s\S]*?\$\$/g, // block math
	/\$[^$\n]+\$/g, // inline math
	/<[^>\n]+>/g, // HTML tags and autolinks
	/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+(\[[ x]\]\s+)?/gm, // heading, quote, list and task markers
	/(^|\s)(#[\p{L}\d/_-]+|\^[\w-]+)/gu, // tags and block ids
	/^\s*\|[\s:|-]*\|\s*$/gm, // table delimiter rows
	/\|/g, // remaining table pipes
	/~~|\*\*|__|==|\*|_/g, // emphasis markers
];

export function maskMarkdown(text: string): string {
	let masked = text;
	// Links: keep the human-readable part, blank the target.
	masked = masked.replace(
		/!?\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]/g,
		(m, target: string, alias?: string) => keepVisible(m, alias ?? target),
	);
	masked = masked.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, (m, label: string) => keepVisible(m, label));
	for (const pattern of BLANKED) {
		masked = masked.replace(pattern, (m) => blank(m.length));
	}
	return masked;
}
