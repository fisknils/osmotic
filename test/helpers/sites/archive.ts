import type { SitePage } from '../create-site.js';

// A blog archive with heavy pages: a long chain of listing pages joined by "Older posts"
// links, each listing linking to its articles. Every page carries `padding` bytes of
// markup, as real pages do with navigation, scripts and footers, so a page kept in
// memory by mistake is easy to see.

export interface ArchiveOptions {
	/** Number of listing pages. */
	pages: number;
	/** Articles linked from each listing page. @defaultValue `0` */
	articles?: number;
	/** Bytes of filler markup per page. @defaultValue `100_000` */
	padding?: number;
}

const filler = (bytes: number) =>
	'<p class="filler">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.</p>'.repeat(
		Math.ceil(bytes / 100),
	);

/** The path of listing page `n`, counting from 1. */
export const archivePage = (n: number) => (n === 1 ? '/archive' : `/archive?page=${n}`);

/** The path of article `i` on listing page `n`. */
export const archiveArticle = (n: number, i: number) => `/post/${n}-${i}`;

export function archive({ pages, articles = 0, padding = 100_000 }: ArchiveOptions): Record<string, SitePage> {
	const site: Record<string, SitePage> = {};
	for (let n = 1; n <= pages; n++) {
		const posts = Array.from(
			{ length: articles },
			(_, i) =>
				`<article data-slug="post-number-${n}-${i}-in-the-archive"><a href="${archiveArticle(n, i)}">Post ${n}-${i}</a></article>`,
		).join('');
		const older = n < pages ? `<a class="older" href="${archivePage(n + 1)}">Older posts</a>` : '';
		site[archivePage(n)] =
			`<!doctype html><html><body><h1>Archive, page ${n}</h1>${posts}${older}${filler(padding)}</body></html>`;
		for (let i = 0; i < articles; i++) {
			site[archiveArticle(n, i)] =
				`<!doctype html><html><body><article data-slug="post-number-${n}-${i}-in-the-archive"><h1>Post ${n}-${i}</h1></article>${filler(padding)}</body></html>`;
		}
	}
	// Joined strings stay ropes until first read, and serving a page would then flatten it in
	// place, growing the heap during the run as if the scraper had kept the page
	for (const [path, body] of Object.entries(site)) site[path] = Buffer.from(body as string).toString();
	return site;
}
