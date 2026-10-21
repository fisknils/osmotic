import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

/** Fields collected along a branch of the chain. */
export type Data = Record<string, unknown>;

/** A DOM node, or the Cheerio-wrapped document root of a freshly loaded page. */
export type PageNode = AnyNode | Cheerio<AnyNode>;

/** A loaded page and the current position in it. */
export interface Page {
	/** The Cheerio instance for the page. */
	$: CheerioAPI;
	/** The current element; the document root right after the page loads. */
	node: PageNode;
	/** The page URL, after redirects. */
	url: string;
	/** Base for relative links: `<base href>` if present, else {@link Page.url}. */
	base: string;
}

/** State passed along the chain. The page fields are present once a page is loaded. */
export interface Context extends Partial<Page> {
	data: Data;
}

/** Continues the chain with the given context. */
export type Next = (ctx: Context) => Promise<void>;

/**
 * A chain step. Call `next(ctx)` zero times to stop the branch, once to continue,
 * or several times to branch.
 */
export type Step = (ctx: Context, next: Next) => Promise<void>;
