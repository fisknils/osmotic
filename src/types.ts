import type { Cheerio, CheerioAPI, CheerioOptions } from 'cheerio';
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

/**
 * What to extract, relative to the current node:
 *
 * - `'selector'`: trimmed text of the first match
 * - `'selector@attr'`: attribute of the first match (`'@attr'` reads the node itself)
 * - `''`: text of the node itself
 * - `['selector']` or `['selector@attr']`: values from every match
 * - `['selector', { key: spec }]`: one object per match, each spec resolved relative to it
 * - `{ key: spec }`: an object, each spec resolved the same way
 */
export type Spec = string | string[] | [string, { [key: string]: Spec }] | { [key: string]: Spec };

/** The value a {@link Spec} resolves to; `undefined` when nothing matched. */
export type Extracted = string | undefined | Extracted[] | { [key: string]: Extracted };

/** Custom selector pseudo-classes: a selector alias or `(element, argument) => boolean`. */
export type Pseudos = NonNullable<CheerioOptions['pseudos']>;

/** Per-slot settings. A field left out falls back to the global option. */
export interface SlotConfig {
	/** Proxy URL for this slot's requests. */
	proxy?: string;
	userAgent?: string;
	/** Milliseconds to wait before each of this slot's requests. */
	delay?: number;
	/** Extra headers, applied over the global ones. */
	headers?: Record<string, string>;
}

/** A concurrent request slot. */
export interface Slot extends SlotConfig {
	/** Index of the slot, in the order of {@link OsmoticOptions.slots}. */
	id: number;
}

/** A request as seen by {@link FetchMiddleware}. */
export interface FetchRequest {
	url: string;
	headers: Record<string, string>;
	/** The slot making the request. */
	slot: Slot;
}

/** Passes the request on to the next middleware, or to the network. */
export type FetchNext = (req: FetchRequest) => Promise<Response>;

/**
 * Wraps every HTTP request. Middleware runs in the order added.
 *
 * It may carry `onStart` and `onEnd` hooks, which `useFetch()` registers as
 * `start` and `end` handlers, so a middleware can set up and clean up after itself.
 */
export interface FetchMiddleware {
	(req: FetchRequest, next: FetchNext): Promise<Response>;
	onStart?: () => unknown;
	onEnd?: () => unknown;
}

/** Options for `Osmotic.config()`. */
export interface OsmoticOptions {
	/**
	 * Maximum parallel requests. Ignored when `slots` is set.
	 * @defaultValue `4`
	 */
	concurrency: number;
	/**
	 * Maximum number of fetch attempts per run.
	 * @defaultValue `100`
	 */
	maxPages: number;
	/**
	 * Milliseconds to wait before each request.
	 * @defaultValue `0`
	 */
	delay: number;
	/**
	 * `User-Agent` header.
	 * @defaultValue `'osmotic/0.1'`
	 */
	userAgent: string;
	/**
	 * Extra headers for every request.
	 * @defaultValue `{}`
	 */
	headers: Record<string, string>;
	/**
	 * Custom selector pseudo-classes.
	 * @defaultValue `{}`
	 */
	pseudos: Pseudos;
	/**
	 * Per-slot settings, one object per concurrent slot.
	 * @defaultValue `null`
	 * @example
	 * ```ts
	 * [{ proxy: 'http://p1:8080', userAgent: 'UA 1', delay: 500 }, { proxy: 'http://p2:8080' }]
	 * ```
	 */
	slots: SlotConfig[] | null;
	/**
	 * Skip URLs disallowed by the site's `robots.txt`.
	 * @defaultValue `true`
	 */
	respectRobots: boolean;
	/**
	 * Space requests to a site by its `Crawl-delay`, across all slots.
	 * @defaultValue `true`
	 */
	respectCrawlDelay: boolean;
	/**
	 * User agent to match in `robots.txt`. Defaults to `userAgent`.
	 * @defaultValue `null`
	 */
	robotsUserAgent: string | null;
	/**
	 * Return URL attributes from `set()` (`href`, `src` and so on) as absolute URLs.
	 * @defaultValue `true`
	 */
	resolveUrls: boolean;
}
