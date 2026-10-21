import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CheerioAPI } from 'cheerio';
import { Osmotic, type Step } from '../src/index.cjs';
import { archive, archivePage, heapUsed, LiveSet, openSite, peakHeap } from './helpers/index.js';

// Record the DOM of every page reaching this step, without keeping it alive
const track =
	(pages: LiveSet<CheerioAPI>): Step =>
	(ctx, next) => {
		pages.add(new URL(ctx.url!).pathname + new URL(ctx.url!).search, ctx.$!);
		return next(ctx);
	};

test('a long crawl keeps only the pages it is working on in memory', async (t) => {
	const site = await openSite(t, archive({ pages: 30 }));
	const pages = new LiveSet<CheerioAPI>();
	const mostAlive: number[] = [];
	await Osmotic.get(site.url(archivePage(1)))
		.recurse('a.older@href')
		.use(track(pages))
		.use(async (ctx, next) => {
			mostAlive.push((await pages.alive()).length);
			return next(ctx);
		})
		.run();
	assert.equal(mostAlive.length, 30);
	assert.ok(Math.max(...mostAlive) <= 3, `page DOMs alive at each page: ${mostAlive.join(', ')}`);
});

test("a page's DOM is released while requests for its links wait for a slot", async (t) => {
	const site = await openSite(t, archive({ pages: 1, articles: 20 }));
	const pages = new LiveSet<CheerioAPI>();
	const listingAlive: boolean[] = [];
	await Osmotic.get(site.url(archivePage(1)))
		.use(track(pages))
		.follow('article a@href')
		.use(async (ctx, next) => {
			listingAlive.push((await pages.alive()).includes(archivePage(1)));
			return next(ctx);
		})
		.config({ concurrency: 1 })
		.run();
	assert.equal(listingAlive.length, 20);
	assert.deepEqual(listingAlive, Array(20).fill(false), 'the listing page is collected before its articles finish');
});

// osmotic copies attribute values (detach() in src/extract.ts), because V8 can keep a short
// substring as a slice of the whole page. cheerio's current parser builds new strings, so this
// guards the outcome rather than detach() itself.
test("extracted values don't keep the pages' HTML alive", async (t) => {
	const site = await openSite(t, archive({ pages: 1, articles: 10, padding: 1_000_000 }));
	const rows: unknown[] = [];
	const before = await heapUsed();
	await Osmotic.get(site.url(archivePage(1)))
		.follow('article a@href')
		.set({ slug: 'article@data-slug' }) // At least 13 characters, so V8 may keep it as a slice of the HTML
		.data((d) => void rows.push(d))
		.config({ concurrency: 4 })
		.run();
	const kept = (await heapUsed()) - before;
	assert.equal(rows.length, 10);
	assert.ok(kept < 3_000_000, `${(kept / 1e6).toFixed(1)} MB kept for 10 short values from 10 MB of pages`);
});

// The peak heap of crawling an archive with `listings` listing pages of 20 articles each
async function crawlPeak(t: { after(fn: () => unknown): void }, listings: number): Promise<number> {
	const site = await openSite(t, archive({ pages: listings, articles: 20, padding: 50_000 }));
	return peakHeap((sample) =>
		Osmotic.get(site.url(archivePage(1)))
			.recurse('a.older@href')
			.follow('article a@href')
			.set({ slug: 'article@data-slug', title: 'h1' })
			.use(sample)
			.config({ concurrency: 4, maxPages: 1000 })
			.run(),
	);
}

test('memory stays flat as a crawl gets longer', async (t) => {
	await crawlPeak(t, 1); // Warm-up: one-time costs, such as compiling code, would count against the first crawl
	const short = await crawlPeak(t, 2); // 42 pages
	const long = await crawlPeak(t, 8); // 168 pages
	const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
	// Without a leak the difference stays under 0.6 MB; keeping 12 kB per page adds 1.5 MB
	assert.ok(
		long - short < 1_500_000,
		`peak heap ${mb(short)} for 42 pages but ${mb(long)} for 168, about ${((long - short) / 126 / 1000).toFixed(0)} kB more per page: memory grows with the length of the crawl`,
	);
});
