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

test('[selector, fields] gives one object per match, resolved relative to it', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/floor-lamp')).set({
		offers: ['.offer', { seller: '.seller', price: '.offer-price' }],
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ offers: [{ seller: 'Lampbutiken', price: '1249 SEK' }] }]);
});

test('several list specs capture several groups from one page into one row', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({
		name: 'h1',
		offers: ['.offer', { seller: '.seller', price: '.offer-price' }],
		specs: ['.specs tr', { label: 'td[1]', value: 'td[2]' }],
	});
	const { rows, page } = await scrape(chain);
	assert.deepEqual(rows, [
		{
			name: 'Desk lamp',
			offers: [
				{ seller: 'Lampbutiken', price: '479 SEK' },
				{ seller: 'Ljus & Co', price: '495 SEK' },
			],
			specs: [
				{ label: 'Power', value: '9 W' },
				{ label: 'Colour', value: 'Black' },
			],
		},
	]);
	assert.equal(page.length, 1);
});

test('the fields of a list spec take every spec form', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({
		offers: [
			'.offer',
			{
				seller: '.seller',
				logo: '.seller-logo@src',
				methods: ['.method'],
				shipping: ['.shipping li', { method: '.method', cost: '.cost' }],
				all: { seller: '.seller', price: '.offer-price' },
				missing: '.nothing@href',
			},
		],
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [
		{
			offers: [
				{
					seller: 'Lampbutiken',
					logo: site.url('/img/sellers/lampbutiken.png'),
					methods: ['Post', 'Pickup'],
					shipping: [
						{ method: 'Post', cost: '49' },
						{ method: 'Pickup', cost: '0' },
					],
					all: { seller: 'Lampbutiken', price: '479 SEK' },
					missing: undefined,
				},
				{
					seller: 'Ljus & Co',
					logo: site.url('/img/sellers/ljus-co.png'),
					methods: ['Post'],
					shipping: [{ method: 'Post', cost: '0' }],
					all: { seller: 'Ljus & Co', price: '495 SEK' },
					missing: undefined,
				},
			],
		},
	]);
});

test('a list selector takes the selector extras', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({
		colour: ['.specs tr[2]', { label: 'td[1]' }],
		post: ['.shipping li:has(.method:text-is("Post"))', { cost: '.cost' }],
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ colour: [{ label: 'Colour' }], post: [{ cost: '49' }, { cost: '0' }] }]);
});

test('a list selector with @attr fails the run', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({
		offers: ['.offer@class', { seller: '.seller' }],
	});
	await assert.rejects(chain.run(), /The selector of a list spec takes no @attr/);
});

test('a list spec without matches gives an empty array', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/usb-charger')).set({
		offers: ['.offer', { seller: '.seller' }],
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ offers: [] }]);
});

for (const [name, spec] of [
	['more than one selector', ['h1', '.tag']],
	['a selector and a list', ['.offer', ['.seller']]],
	['a field object first', [{ seller: '.seller' }, '.offer']],
	['three elements', ['.offer', { seller: '.seller' }, { price: '.offer-price' }]],
	['nothing', []],
] as const) {
	test(`an array spec with ${name} fails the run`, async (t) => {
		const site = await openSite(t, shop);
		const chain = Osmotic.get(site.url('/product/desk-lamp')).set({ bad: spec as unknown as string[] });
		await assert.rejects(chain.run(), /Array specs take \["selector"\] or \["selector", \{ key: spec \}\]/);
	});
}
