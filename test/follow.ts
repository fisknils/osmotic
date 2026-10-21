import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { blog, news, openSite, scrape, shop, sortBy } from './helpers/index.js';

test('.follow() loads every link by default, resolved against <base href>', async (t) => {
	const site = await openSite(t, blog);
	const { rows } = await scrape(Osmotic.get(site.url('/blog/')).follow().set({ title: 'h1' }));
	assert.deepEqual(sortBy(rows, 'title'), [{ title: 'About' }, { title: 'First post' }, { title: 'Second post' }]);
});

test('data collected before .follow() carries over to the new pages', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/'))
		.find('tr.athing')
		.set({ rank: '.rank' })
		.follow('.titleline a@href')
		.set({ page: 'title' });
	const { rows } = await scrape(chain);
	assert.deepEqual(sortBy(rows, 'rank'), [
		{ rank: '1.', page: 'Story 1 | News' },
		{ rank: '2.', page: 'Story 2 | News' },
		{ rank: '3.', page: 'Story 3' }, // On the other host
	]);
});

test('only http(s) links are followed, without fragments', async (t) => {
	const site = await openSite(t, shop);
	const { page, skip } = await scrape(Osmotic.get(site.url('/')).follow('a'));
	assert.deepEqual(
		page.map((p) => p.url).sort(),
		[
			site.otherOrigin + '/partner',
			site.url('/'),
			site.url('/category/chargers'),
			site.url('/category/lamps'),
			site.url('/product/desk-lamp'), // Linked as /product/desk-lamp#reviews
		].sort(),
	);
	// mailto: and javascript: links are never requested; robots.txt keeps out the rest
	assert.deepEqual(skip.map((s) => [s.url, s.reason]).sort(), [
		[site.url('/admin/'), 'robots'],
		[site.url('/cart'), 'robots'],
	]);
});

test('a URL reached from several branches is loaded once', async (t) => {
	const site = await openSite(t, news);
	// Story rows link to /item?id=1 and 2, and every comments row links to its item too
	const { rows } = await scrape(Osmotic.get(site.url('/')).find('tr').follow('a[href^="/item"]').set({ title: 'h1' }));
	assert.deepEqual(sortBy(rows, 'title'), [{ title: 'Story 1' }, { title: 'Story 2' }, { title: 'Story 3' }]);
	assert.equal(site.paths().filter((p) => p === '/item?id=1').length, 1);
});
