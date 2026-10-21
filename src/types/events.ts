import type { Osmotic } from '../core/Osmotic.js';

/**
 * Why a URL was not fetched or not parsed:
 *
 * - `robots`: disallowed by `robots.txt`
 * - `maxPages`: the run reached `maxPages`
 * - `status`: the response status was not 2xx
 * - `contentType`: the response was not HTML
 *
 * Already-visited URLs are not reported, since every link back to a known page would fire.
 */
export type SkipReason = 'robots' | 'maxPages' | 'status' | 'contentType';

/** Totals for a finished run. */
export interface RunStats {
	/** Pages fetched and parsed. */
	pages: number;
	/** URLs skipped because `robots.txt` disallowed them. */
	robotsSkipped: number;
	/** Rows written, by export file. */
	rows: Record<string, number>;
}

/** The payload of each event. */
export interface OsmoticEvents {
	/** Before the first request. Handlers are awaited in order; throwing aborts the run. */
	start: { osmotic: Osmotic };
	/** A page was fetched and parsed. `ms` covers the request and reading the body. */
	page: { url: string; requestedUrl: string; status: number; ms: number };
	/** A URL was not fetched or not parsed. `status` is set for `status` and `contentType`. */
	skip: { url: string; reason: SkipReason; status?: number };
	/** A request failed. Listening replaces the default console output. */
	error: { url: string; error: unknown };
	/** After the run, also when it failed. Every handler runs and is awaited. */
	end: { osmotic: Osmotic; stats: RunStats; error?: unknown };
}

/** The name of a run event. */
export type OsmoticEvent = keyof OsmoticEvents;

/**
 * A listener for event `E`. Handlers may be async.
 *
 * @typeParam E - The event name.
 * @param payload - The event's payload, as described in {@link OsmoticEvents}.
 */
export type Handler<E extends OsmoticEvent> = (payload: OsmoticEvents[E]) => unknown;
