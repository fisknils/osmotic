import type { Slot } from './options.js';

/** A request as seen by {@link FetchMiddleware}. */
export interface FetchRequest {
	/** The absolute URL to fetch. */
	url: string;
	/**
	 * Request headers: `User-Agent` (the slot's or the `userAgent` option), overridden by the
	 * `headers` option, then by the slot's `headers`.
	 */
	headers: Record<string, string>;
	/** The slot making the request. */
	slot: Slot;
	/**
	 * Attach a value to the page this request loads. Steps read it from `ctx.attached[key]`
	 * until the chain leaves the page, as `get()`, `follow()` and `recurse()` do. A later call
	 * with the same key overwrites the value, also across repeated `next(req)` calls.
	 *
	 * osmotic always provides it. It's optional so that code building requests itself, such as
	 * a test for a middleware, needn't. It's a closure, so `next({ ...req, url })` keeps it.
	 *
	 * @param key - The name steps read the value under.
	 * @param value - The value, such as a browser page the middleware keeps open.
	 * @throws Once the middleware chain has returned its response.
	 */
	attach?: (key: string, value: unknown) => void;
	/**
	 * Call `fn` once nothing needs the page this request loads any more: once no step is still
	 * working on it, or right away if the page is skipped or fails. Pages that custom commands
	 * load through `fetchPage()` are released when the run ends. Every callback runs exactly
	 * once, also across repeated `next(req)` calls, and all of them have settled before
	 * exporters close and `end` handlers run, also when the run fails. A callback that throws
	 * or rejects is logged and doesn't fail the run.
	 *
	 * Built-in steps let go of a page as soon as they have passed it on, so `get()`, `follow()`
	 * and `recurse()` don't keep it while their links load. A custom step holds the page until
	 * its promise settles. Pages without callbacks aren't tracked, so they cost nothing.
	 *
	 * osmotic always provides it; it's optional for the same reason as {@link FetchRequest.attach}.
	 *
	 * @param fn - The callback, such as one that closes a browser page; may be async.
	 * @throws Once the middleware chain has returned its response, or if `fn` isn't a function.
	 */
	onRelease?: (fn: () => unknown) => void;
}

/**
 * Passes the request on to the next middleware, or to the network.
 *
 * @param req - The request to send; pass a new object to change it.
 */
export type FetchNext = (req: FetchRequest) => Promise<Response>;

/**
 * Wraps every HTTP request. Middleware runs in the order added.
 *
 * It may carry `onStart` and `onEnd` hooks, which `useFetch()` registers as
 * `start` and `end` handlers, so a middleware can set up and clean up after itself.
 */
export interface FetchMiddleware {
	/**
	 * @param req - The request.
	 * @param next - Sends the request on and resolves to its `Response`.
	 * @returns The response for the request, from `next()` or made up by the middleware.
	 */
	(req: FetchRequest, next: FetchNext): Promise<Response>;
	/** Called before each run of a chain the middleware is part of, as a `start` handler; may be async. */
	onStart?: () => unknown;
	/** Called after each run, also when it failed, as an `end` handler; may be async. */
	onEnd?: () => unknown;
}
