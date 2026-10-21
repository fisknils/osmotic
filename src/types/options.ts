import type { CheerioOptions } from 'cheerio';

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
