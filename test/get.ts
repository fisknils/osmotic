import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { openSite, scrape, shop } from './helpers/index.js';

test('Osmotic.get() loads a page', async (t) => {
	const site = await openSite(t, shop);
	const { rows } = await scrape(Osmotic.get(site.url('/')).set({ title: 'title' }));
	assert.deepEqual(rows, [{ title: 'Gadget Shop' }]);
});

test('.get() mid-chain resolves relative URLs against the current page and keeps data', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/category/lamps'))
		.set({ category: 'h1' })
		.get('?page=2')
		.set({ product: '.product h2' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ category: 'Lamps', product: 'Floor lamp' }]);
});

test('the first .get() needs an absolute URL', async () => {
	await assert.rejects(new Osmotic().get('/category/lamps').run(), TypeError);
});

test('redirects are followed, and the page event reports both URLs', async (t) => {
	const site = await openSite(t, shop);
	const { rows, page } = await scrape(Osmotic.get(site.url('/product/old-charger')).set({ name: 'h1' }));
	assert.deepEqual(rows, [{ name: 'USB charger' }]);
	assert.equal(page.length, 1);
	assert.equal(page[0].url, site.url('/product/usb-charger'));
	assert.equal(page[0].requestedUrl, site.url('/product/old-charger'));
	assert.equal(page[0].status, 200);
});

test('a page with a non-2xx status ends the branch with a status skip', async (t) => {
	const site = await openSite(t, shop);
	const { rows, skip } = await scrape(Osmotic.get(site.url('/product/discontinued')));
	assert.deepEqual(rows, []);
	assert.deepEqual(skip, [{ url: site.url('/product/discontinued'), reason: 'status', status: 404 }]);
});

test('a response that is not HTML ends the branch with a contentType skip', async (t) => {
	const site = await openSite(t, shop);
	const { rows, skip } = await scrape(Osmotic.get(site.url('/manuals/desk-lamp.pdf')));
	assert.deepEqual(rows, []);
	assert.deepEqual(skip, [{ url: site.url('/manuals/desk-lamp.pdf'), reason: 'contentType', status: 200 }]);
});
