import type { CheerioAPI } from 'cheerio';
import type { PageNode } from '../types/context.js';
import { crawlableUrl } from './crawlable-url.js';
import { splitSpec } from './split-spec.js';

// Unique absolute http(s) URLs found by spec ("selector@attr", attr defaults to href)
export function collectLinks($: CheerioAPI, node: PageNode, spec: string, base: string): string[] {
	const [sel, attr = 'href'] = splitSpec(spec);
	const els = sel ? $(node).find(sel).toArray() : [node];
	const urls = new Set<string>();
	for (const el of els) {
		const raw = $(el).attr(attr);
		const url = raw && crawlableUrl(raw, base);
		if (url) urls.add(url);
	}
	return [...urls];
}
