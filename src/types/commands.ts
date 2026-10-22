import type { Osmotic } from '../core/Osmotic.js';
import type { CheerioAPI } from 'cheerio';
import type { Data, PageNode } from './context.js';
import type { Slot } from './options.js';

/**
 * The test for {@link Osmotic.filter}: a selector that passes when the current node
 * contains a match, or a function that passes when it returns or resolves to a truthy value.
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

/** Options for {@link Osmotic.inSlot}. */
export interface InSlotOptions {
	/**
	 * Wait for this slot, matched by `id`, instead of taking any free one. Pass the slot that
	 * loaded the page, such as one a middleware attached from `req.slot`, so the work goes
	 * through the same proxy and is spaced by the same delay.
	 * @defaultValue any free slot
	 */
	slot?: Slot;
	/**
	 * The URL the work requests, so it waits out that site's `Crawl-delay` too, shared with
	 * page loads.
	 * @defaultValue none, so no `Crawl-delay` is waited for
	 */
	url?: string;
	/**
	 * Waiters with a higher priority get the next free slot first. Page loads use their step's
	 * position in the chain, so the default goes ahead of all of them.
	 * @defaultValue `Infinity`
	 */
	priority?: number;
}
