import type { CheerioAPI } from 'cheerio';
import type { Data, PageNode } from './context.js';

/**
 * The test for {@link Osmotic.filter}: a selector that passes when the current node
 * contains a match, or a function that passes when it returns true.
 */
export type FilterTest = string | (($: CheerioAPI, node: PageNode, data: Data) => boolean | Promise<boolean>);

/** Options for {@link Osmotic.recurse}. */
export interface RecurseOptions {
	/**
	 * Only follow links to the current page's host.
	 * @defaultValue `true`
	 */
	sameDomain?: boolean;
	/**
	 * Skip URLs whose pathname matches any of these.
	 * @defaultValue `[]`
	 */
	exclude?: RegExp[];
}
