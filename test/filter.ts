import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CheerioAPI } from 'cheerio';
import { Osmotic } from '../src/index.cjs';
import { news, openSite, scrape, shop, sortBy } from './helpers/index.js';

test('a selector passes when the current node contains a match', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/'))
		.find('tr.athing')
		.filter('.titleline a[href^="/item"]')
		.set({ rank: '.rank' });
	const { rows } = await scrape(chain);
	assert.deepEqual(sortBy(rows, 'rank'), [{ rank: '1.' }, { rank: '2.' }]);
});

test('a function gets $, the node and the data, and passes when it returns true', async (t) => {
	const site = await openSite(t, news);
	const seen: unknown[] = [];
	const chain = Osmotic.get(site.url('/'))
		.find('tr.athing')
		.set({ rank: '.rank' })
		.filter(($, node, data) => {
			seen.push([typeof $, $(node).attr('class')]);
			return data.rank === '2.';
		})
		.set({ title: '.titleline > a' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ rank: '2.', title: 'Story 2' }]);
	assert.deepEqual(seen, Array(3).fill(['function', 'athing']));
});

test('an async function is awaited', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/'))
		.find('tr.athing')
		.filter(async ($, node) => {
			await new Promise((r) => setTimeout(r, 10));
			return $(node).attr('id') === '3';
		})
		.set({ title: '.titleline > a' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ title: 'Story 3' }]);
});

test('a page-level test keeps only product pages among followed links', async (t) => {
	const site = await openSite(t, shop);
	const isProductPage = ($: CheerioAPI) => $('script[type="application/ld+json"]').text().includes('"Product"');
	const chain = Osmotic.get(site.url('/')).follow('nav a, .featured a').filter(isProductPage).set({ name: 'h1' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ name: 'Desk lamp' }]);
});
