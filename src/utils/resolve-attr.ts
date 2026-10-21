// Attributes whose values are URLs (srcset is handled separately)
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'longdesc', 'data']);

function resolveUrl(value: string, base: string): string {
	if (!value) return value; // Keep empty values empty instead of resolving to the base
	try {
		return new URL(value.trim(), base).href;
	} catch {
		return value; // Leave malformed URLs untouched
	}
}

// Resolve URL attributes against base; other attributes are returned unchanged
export function resolveAttr(attr: string, value: string | undefined, base: string | null): string | undefined {
	if (!base || value === undefined) return value;
	const name = attr.toLowerCase();
	if (URL_ATTRS.has(name)) return resolveUrl(value, base);
	if (name === 'srcset') {
		// "a.jpg 1x, b.jpg 2x" -> resolve each candidate, keep its descriptor
		return value
			.split(',')
			.map((candidate) => {
				const [url, ...descriptor] = candidate.trim().split(/\s+/);
				return [resolveUrl(url, base), ...descriptor].join(' ');
			})
			.join(', ');
	}
	return value;
}
