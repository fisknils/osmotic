// Translate XPath-style indexes outside quotes: "span[4]" -> "span:nth-of-type(4)"
export function normalizeSelector(sel: string): string {
	return sel
		.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)
		.map((part, i) => (i % 2 ? part : part.replace(/\[(\d+)\]/g, ':nth-of-type($1)')))
		.join('');
}
