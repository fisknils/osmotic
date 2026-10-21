import type { CheerioAPI } from 'cheerio';
import { splitSpec } from './selectors.js';
import { crawlableUrl, resolveAttr } from './urls.js';
import type { Extracted, PageNode, Spec } from './types.js';

// Copy of an attribute value that doesn't share memory with the page. V8 may store
// a substring as a slice of the parser's input, so a short value kept in data
// would otherwise keep a large part of the page's HTML alive.
const detach = (v: string | undefined): string | undefined =>
	v === undefined ? v : (JSON.parse(JSON.stringify(v)) as string);

// Extract a value relative to node. Spec forms:
//   "selector"        text of the first match
//   "selector@attr"   attribute of the first match ("@attr" = the node itself)
//   ["selector@attr"] list of values from all matches
//   ["selector", { key: spec }]
//                     list of objects, one per match, each spec resolved relative to it
//   { key: spec }     nested object, each spec resolved relative to node
// When base is given, URL attributes are resolved to absolute URLs against it.
export function pick($: CheerioAPI, node: PageNode, spec: Spec, base: string | null = null): Extracted {
	if (Array.isArray(spec)) {
		const [first, fields] = spec;
		const isFields = fields !== null && typeof fields === 'object' && !Array.isArray(fields);
		if (typeof first !== 'string' || (spec.length === 2 ? !isFields : spec.length !== 1)) {
			throw new Error('Array specs take ["selector"] or ["selector", { key: spec }], e.g. ["img@src"]');
		}
		if (isFields) {
			const targets = first ? $(node).find(first).toArray() : [node];
			return targets.map((el) => pick($, el, fields, base));
		}
		const [sel, attr] = splitSpec(first);
		const targets = sel ? $(node).find(sel).toArray() : [node];
		return targets
			.map((el) => (attr ? resolveAttr(attr, detach($(el).attr(attr)), base) : $(el).text().trim()))
			.filter((v) => v !== undefined);
	}
	if (spec && typeof spec === 'object') {
		return Object.fromEntries(Object.entries(spec).map(([k, s]) => [k, pick($, node, s, base)]));
	}
	const [sel, attr] = splitSpec(spec);
	const target = sel ? $(node).find(sel).first() : $(node);
	return attr ? resolveAttr(attr, detach(target.attr(attr)), base) : target.text().trim();
}

// Unique absolute http(s) URLs found by spec ("selector@attr", attr defaults to href)
export function links($: CheerioAPI, node: PageNode, spec: string, base: string): string[] {
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
