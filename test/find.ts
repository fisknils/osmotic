import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { news, openSite, scrape, sortBy } from './helpers/index.js';

test('.find() continues once per match', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/')).find('tr.athing').set({ rank: '.rank', title: '.titleline > a' });
	const { rows } = await scrape(chain);
	assert.deepEqual(sortBy(rows, 'rank'), [
		{ rank: '1.', title: 'Story 1' },
		{ rank: '2.', title: 'Story 2' },
		{ rank: '3.', title: 'Story 3' },
	]);
});

test('a nested .find() searches inside the current match', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/')).find('tr.athing').find('.titleline a').set({ title: '' });
	const { rows } = await scrape(chain);
	assert.deepEqual(sortBy(rows, 'title'), [{ title: 'Story 1' }, { title: 'Story 2' }, { title: 'Story 3' }]);
});

test('.find() without matches ends the branch', async (t) => {
	const site = await openSite(t, news);
	const { rows } = await scrape(Osmotic.get(site.url('/')).find('.nothing'));
	assert.deepEqual(rows, []);
});

test('.find() before any page is loaded fails the run', async () => {
	await assert.rejects(new Osmotic().find('a').run(), /No page loaded yet/);
});
