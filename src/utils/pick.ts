import type { CheerioAPI } from 'cheerio';
import { splitSpec } from './split-spec.js';
import { resolveAttr } from './resolve-attr.js';
import type { PageNode } from '../types/context.js';
import type { Extracted, Spec } from '../types/specs.js';

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
//                     list of objects, one per match, each spec resolved relative to it;
//                     the selector takes no @attr
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
			const [sel, attr] = splitSpec(first);
			if (attr) {
				throw new Error(`The selector of a list spec takes no @attr: "${first}"`);
			}
			const targets = sel ? $(node).find(sel).toArray() : [node];
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
