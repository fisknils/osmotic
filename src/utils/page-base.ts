import type { CheerioAPI } from 'cheerio';
import { isHttp } from './is-http.js';

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
