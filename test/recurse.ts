import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { news, openSite, scrape, shop } from './helpers/index.js';

test('.recurse() follows pagination and runs the rest of the chain on every page', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/')).recurse('a[rel="next"]@href').find('tr.athing').set({ rank: '.rank' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows.map((r) => r.rank).sort(), ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.']);
});

test('.recurse() crawls a whole site, each URL once, staying on its host', async (t) => {
	const site = await openSite(t, shop);
	const { page, skip } = await scrape(Osmotic.get(site.url('/')).recurse());
	assert.deepEqual(page.map((p) => p.url).sort(), [
		site.url('/'),
		site.url('/category/chargers'),
		site.url('/category/lamps'),
		site.url('/category/lamps?page=2'),
		site.url('/product/desk-lamp'),
		site.url('/product/floor-lamp'),
		site.url('/product/usb-charger'), // Through the redirect from /product/old-charger
	]);
	assert.ok(site.requests.every((r) => r.host === new URL(site.origin).host));
	const reasons = Object.fromEntries(skip.map((s) => [new URL(s.url).pathname, s.reason]));
	assert.deepEqual(reasons, {
		'/admin/': 'robots',
		'/cart': 'robots',
		'/product/discontinued': 'status',
		'/manuals/desk-lamp.pdf': 'contentType',
		'/manuals/floor-lamp.pdf': 'contentType',
		'/manuals/usb-charger.pdf': 'contentType',
	});
	const counts = new Map<string, number>();
	for (const p of site.paths()) counts.set(p, (counts.get(p) ?? 0) + 1);
	assert.ok(
		[...counts.values()].every((n) => n === 1),
		'every URL is requested once',
	);
});

test('sameDomain: false also follows links to other hosts', async (t) => {
	const site = await openSite(t, shop);
	const { page } = await scrape(Osmotic.get(site.url('/')).recurse('a@href', { sameDomain: false }));
	const urls = page.map((p) => p.url);
	assert.ok(urls.includes(site.otherOrigin + '/partner'));
	assert.ok(urls.includes(site.otherOrigin + '/'), 'the other host is crawled from its own links');
});

test('exclude skips links whose pathname matches', async (t) => {
	const site = await openSite(t, shop);
	const { page } = await scrape(Osmotic.get(site.url('/')).recurse('a@href', { exclude: [/^\/product\//] }));
	assert.deepEqual(page.map((p) => new URL(p.url).pathname + new URL(p.url).search).sort(), [
		'/',
		'/category/chargers',
		'/category/lamps',
		'/category/lamps?page=2',
	]);
	assert.ok(!site.paths().some((p) => p.startsWith('/product/')));
});
