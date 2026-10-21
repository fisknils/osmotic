import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { blog, openSite, scrape, shop, sortBy } from './helpers/index.js';

test('every spec form extracts from a product page', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({
		name: 'h1',
		image: 'meta[property="og:image"]@content',
		photo: '.photo@src',
		srcset: '.photo@srcset',
		tags: ['.tag'],
		links: ['a@href'],
		price: { amount: '.price .value', currency: '.price .currency' },
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [
		{
			name: 'Desk lamp',
			image: '/img/desk-lamp.jpg', // content isn't a URL attribute, so it stays as written
			photo: site.url('/img/desk-lamp.jpg'),
			srcset: `${site.url('/img/desk-lamp.jpg')} 1x, ${site.url('/img/desk-lamp@2x.jpg')} 2x`,
			tags: ['LED', 'Dimmable'],
			links: [site.url('/manuals/desk-lamp.pdf'), site.url('/')],
			price: { amount: '499', currency: 'SEK' },
		},
	]);
});

test('"@attr" and "" read the current node itself', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/category/lamps')).find('.product').set({ sku: '@data-sku' }).find('h2').set({
		name: '',
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ sku: 'DESK-LAMP', name: 'Desk lamp' }]);
});

test('missing values: empty text, undefined attributes, and no array entries', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/usb-charger')).set({
		text: '.nothing',
		attr: '.nothing@href',
		tags: ['.tag'],
		skus: ['li@data-sku'],
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ text: '', attr: undefined, tags: [], skus: [] }]);
});

test('resolveUrls: false returns URL attributes as written', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp'))
		.config({ resolveUrls: false })
		.set({ photo: '.photo@src', manual: '.manual@href' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ photo: '/img/desk-lamp.jpg', manual: '/manuals/desk-lamp.pdf' }]);
});

test('URL attributes resolve against <base href>', async (t) => {
	const site = await openSite(t, blog);
	const chain = Osmotic.get(site.url('/blog/')).find('article').set({ link: 'a@href', image: 'img@src' });
	const { rows } = await scrape(chain);
	assert.deepEqual(sortBy(rows, 'link'), [
		{ link: site.url('/blog/posts/first.html'), image: site.url('/blog/posts/first.jpg') },
		{ link: site.url('/blog/posts/second.html'), image: site.url('/blog/posts/second.jpg') },
	]);
});

test('a later .set() merges into the data and overrides earlier keys', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp'))
		.set({ name: 'title', price: '.price .value' })
		.set({ name: 'h1' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ name: 'Desk lamp', price: '499' }]);
});

test('an array spec with more than one selector fails the run', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({ both: ['h1', '.tag'] as unknown as string[] });
	await assert.rejects(chain.run(), /Array specs take a single selector string/);
});
