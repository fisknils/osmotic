import type { Slot } from './options.js';

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
