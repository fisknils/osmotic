import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { openSite, scrape, shop } from './helpers/index.js';

const pages = (robots: string) => ({
	'/robots.txt': { type: 'text/plain', body: robots },
	'/': '<a href="/a">A</a> <a href="/b">B</a> <a href="/private">Private</a>',
	'/a': '<h1>A</h1>',
	'/b': '<h1>B</h1>',
	'/private': '<h1>Private</h1>',
});

test('URLs disallowed by robots.txt are skipped and counted', async (t) => {
	const site = await openSite(t, shop);
	const { skip, end } = await scrape(Osmotic.get(site.url('/')).follow('nav a'));
	assert.deepEqual(
		skip.map((s) => s.reason),
		['robots', 'robots'],
	);
	assert.equal(end?.stats.robotsSkipped, 2);
	assert.ok(!site.paths().includes('/cart') && !site.paths().includes('/admin/'));
});

test('respectRobots: false fetches disallowed URLs, and robots.txt is not requested', async (t) => {
	const site = await openSite(t, shop);
	const { skip } = await scrape(Osmotic.get(site.url('/')).follow('nav a').config({ respectRobots: false }));
	assert.equal(skip.filter((s) => s.reason === 'robots').length, 0);
	assert.ok(site.paths().includes('/cart') && site.paths().includes('/admin/'));
	assert.ok(!site.paths().includes('/robots.txt'));
});

test('robots.txt is fetched once per host, with the user agent', async (t) => {
	const site = await openSite(t, shop);
	await scrape(Osmotic.get(site.url('/')).recurse('a@href', { sameDomain: false }).config({ userAgent: 'ShopBot/2' }));
	const robots = site.requests.filter((r) => r.path === '/robots.txt');
	assert.deepEqual(robots.map((r) => r.host).sort(), [new URL(site.origin).host, new URL(site.otherOrigin).host]);
	assert.ok(robots.every((r) => r.headers['user-agent'] === 'ShopBot/2'));
});

test('robotsUserAgent picks the robots.txt group to obey', async (t) => {
	const site = await openSite(t, pages('User-agent: special-bot\nDisallow: /private\n'));
	const chain = () => Osmotic.get(site.url('/')).follow().set({ h: 'h1' });
	assert.equal((await scrape(chain())).rows.length, 3, 'the default user agent is not in the group');
	const { rows, skip } = await scrape(chain().config({ robotsUserAgent: 'special-bot' }));
	assert.equal(rows.length, 2);
	assert.deepEqual(skip, [{ url: site.url('/private'), reason: 'robots' }]);
});

test('Crawl-delay spaces requests to a host, across all slots', async (t) => {
	const site = await openSite(t, pages('User-agent: *\nCrawl-delay: 0.5\n'));
	await scrape(Osmotic.get(site.url('/')).follow('a[href="/a"], a[href="/b"]').config({ concurrency: 4 }));
	const times = site.requests.filter((r) => r.path !== '/robots.txt').map((r) => r.at);
	assert.equal(times.length, 3);
	for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 450, `gap ${times[i] - times[i - 1]}ms`);
});

test('respectCrawlDelay: false ignores Crawl-delay', async (t) => {
	const site = await openSite(t, pages('User-agent: *\nCrawl-delay: 5\n'));
	const started = Date.now();
	await scrape(Osmotic.get(site.url('/')).follow('a[href="/a"]').config({ respectCrawlDelay: false }));
	assert.ok(Date.now() - started < 2000);
});
