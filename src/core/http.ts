import type { Dispatcher } from 'undici';
import type { FetchMiddleware, FetchRequest } from '../types/fetch.js';
import type { Slot } from '../types/options.js';

// Proxy agent per slot, created on the slot's first request
const dispatchers = new WeakMap<Slot, Dispatcher>();

// Pass req through the middleware in the order given, ending in the HTTP request
export function fetchThrough(middleware: FetchMiddleware[], req: FetchRequest): Promise<Response> {
	const dispatch =
		(i: number) =>
		(r: FetchRequest): Promise<Response> =>
			i < middleware.length ? middleware[i](r, dispatch(i + 1)) : rawFetch(r);
	return dispatch(0)(req);
}

// The actual HTTP request, at the end of the middleware chain
async function rawFetch({ url, headers, slot }: FetchRequest): Promise<Response> {
	if (!slot.proxy) return fetch(url, { headers });

	// Proxies need undici (npm install undici); loaded only when a slot uses one
	const undici = await import('undici');
	let dispatcher = dispatchers.get(slot);
	if (!dispatcher) {
		dispatcher = new undici.ProxyAgent(slot.proxy);
		dispatchers.set(slot, dispatcher);
	}
	return (await undici.fetch(url, { headers, dispatcher })) as unknown as Response;
}
