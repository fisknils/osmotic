import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { news, openSite, scrape } from './helpers/index.js';

// An index linking to six slow pages, to watch how requests are scheduled
const slow = {
	'/': [1, 2, 3, 4, 5, 6].map((i) => `<a href="/p${i}">${i}</a>`).join(''),
	...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`/p${i}`, { body: `<h1>${i}</h1>`, wait: 50 }])),
};

test('maxPages limits fetch attempts and skips the rest', async (t) => {
	const site = await openSite(t, news);
	const { page, skip } = await scrape(Osmotic.get(site.url('/')).follow('.titleline a').config({ maxPages: 2 }));
	assert.equal(page.length, 2);
	assert.deepEqual(
		skip.map((s) => s.reason),
		['maxPages', 'maxPages'],
	);
});

test('concurrency limits parallel requests', async (t) => {
	const two = await openSite(t, slow);
	await scrape(Osmotic.get(two.url('/')).follow().config({ concurrency: 2 }));
	assert.equal(two.maxActive(), 2);
	const four = await openSite(t, slow);
	await scrape(Osmotic.get(four.url('/')).follow());
	assert.equal(four.maxActive(), 4, 'the default is 4');
});

test('delay waits before each request', async (t) => {
	const site = await openSite(t, news);
	await scrape(Osmotic.get(site.url('/')).get('?p=2').config({ delay: 150 }));
	const [first, second] = site.requests.filter((r) => r.path !== '/robots.txt');
	assert.ok(second.at - first.at >= 140, `gap ${second.at - first.at}ms`);
});

test('userAgent and headers are sent with every request', async (t) => {
	const site = await openSite(t, news);
	await scrape(
		Osmotic.get(site.url('/'))
			.get('?p=2')
			.config({ userAgent: 'NewsBot/1', headers: { 'Accept-Language': 'sv' } }),
	);
	const pages = site.requests.filter((r) => r.path !== '/robots.txt');
	assert.equal(pages.length, 2);
	for (const r of pages) {
		assert.equal(r.headers['user-agent'], 'NewsBot/1');
		assert.equal(r.headers['accept-language'], 'sv');
	}
});

test('the default user agent is osmotic/0.1', async (t) => {
	const site = await openSite(t, news);
	await scrape(Osmotic.get(site.url('/')));
	assert.ok(site.requests.every((r) => r.headers['user-agent'] === 'osmotic/0.1'));
});

test('slots set the number of parallel requests and their own identity', async (t) => {
	const site = await openSite(t, slow);
	const chain = Osmotic.get(site.url('/'))
		.follow()
		.config({
			concurrency: 10, // Ignored when slots are set
			userAgent: 'Global',
			headers: { 'X-Global': 'yes' },
			slots: [{ userAgent: 'Slot A' }, { headers: { 'X-Slot': 'b' } }],
		});
	await scrape(chain);
	assert.equal(site.maxActive(), 2);
	const pages = site.requests.filter((r) => r.path !== '/robots.txt');
	assert.equal(pages.length, 7);
	for (const r of pages) {
		assert.equal(r.headers['x-global'], 'yes');
		const slotA = r.headers['user-agent'] === 'Slot A';
		assert.ok(slotA || (r.headers['user-agent'] === 'Global' && r.headers['x-slot'] === 'b'));
	}
	assert.ok(pages.some((r) => r.headers['user-agent'] === 'Slot A'));
	assert.ok(pages.some((r) => r.headers['x-slot'] === 'b'));
});

test('a slot delay replaces the global delay for that slot', async (t) => {
	const site = await openSite(t, news);
	await scrape(
		Osmotic.get(site.url('/'))
			.get('?p=2')
			.config({ delay: 0, slots: [{ delay: 150 }] }),
	);
	const [first, second] = site.requests.filter((r) => r.path !== '/robots.txt');
	assert.ok(second.at - first.at >= 140, `gap ${second.at - first.at}ms`);
});
