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
