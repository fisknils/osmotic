import { isHttp } from './is-http.js';

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
