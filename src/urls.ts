import type { CheerioAPI } from 'cheerio';

// Attributes whose values are URLs (srcset is handled separately)
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'longdesc', 'data']);

const isHttp = (u: URL) => u.protocol === 'http:' || u.protocol === 'https:';

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

// Absolute http(s) URL of raw against base with the fragment removed, or null
export function crawlableUrl(raw: string, base: string): string | null {
	try {
		const u = new URL(raw, base);
		u.hash = '';
		return isHttp(u) ? u.href : null;
	} catch {
		return null; // Ignore malformed URLs
	}
}

// Base for relative links: the first <base href> if valid, else the page URL
export function pageBase($: CheerioAPI, pageUrl: string): string {
	const href = $('base[href]').first().attr('href');
	if (!href) return pageUrl;
	try {
		const u = new URL(href, pageUrl);
		return isHttp(u) ? u.href : pageUrl;
	} catch {
		return pageUrl; // Malformed <base href> is ignored, as browsers do
	}
}
