import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A page of a test site: an HTML string, or a response described field by field. */
export type SitePage =
	| string
	| {
			/** @defaultValue `200`, or `302` with `redirect` */
			status?: number;
			/** `Content-Type` header. @defaultValue `'text/html'` */
			type?: string;
			body?: string;
			headers?: Record<string, string>;
			/** Redirect to this path or URL. */
			redirect?: string;
	  };

/** A request the site received. */
export interface SiteRequest {
	/** Path and query, such as `/a?page=2`. */
	path: string;
	/** `127.0.0.1` or `localhost`, with the port. */
	host: string;
	headers: IncomingHttpHeaders;
}

export interface Site {
	/** `http://127.0.0.1:<port>` */
	origin: string;
	/** `http://localhost:<port>`: the same site under another hostname, for cross-domain tests. */
	otherOrigin: string;
	/** The absolute URL of `path` on {@link Site.origin}. */
	url(path?: string): string;
	/** Every request received, in order. */
	requests: SiteRequest[];
	/** The paths of {@link Site.requests}, in order. */
	paths(): string[];
	close(): Promise<void>;
}

/**
 * Serve `pages`, keyed by path (with query, if any), on a local HTTP server. Paths
 * without an entry return 404, so a site without `/robots.txt` allows everything.
 *
 * @example
 * ```ts
 * const site = await createSite({
 * 	'/': '<a href="/a">A</a>',
 * 	'/a': '<h1>A</h1>',
 * 	'/gone': { status: 410 },
 * });
 * after(() => site.close());
 * ```
 */
export async function createSite(pages: Record<string, SitePage>): Promise<Site> {
	const requests: SiteRequest[] = [];
	const server = createServer((req, res) => {
		const path = req.url ?? '/';
		requests.push({ path, host: req.headers.host ?? '', headers: req.headers });
		const page = pages[path];
		if (page === undefined) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			res.end('Not found');
			return;
		}
		const {
			status,
			type = 'text/html',
			body = '',
			headers = {},
			redirect,
		} = typeof page === 'string' ? { body: page } : page;
		res.writeHead(status ?? (redirect ? 302 : 200), {
			'content-type': type,
			...(redirect ? { location: redirect } : {}),
			...headers,
		});
		res.end(body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	const origin = `http://127.0.0.1:${port}`;
	return {
		origin,
		otherOrigin: `http://localhost:${port}`,
		url: (path = '/') => origin + path,
		requests,
		paths: () => requests.map((r) => r.path),
		close: () =>
			new Promise((resolve, reject) => {
				server.closeAllConnections(); // Keep-alive connections would hold close() open
				server.close((err) => (err ? reject(err) : resolve()));
			}),
	};
}
