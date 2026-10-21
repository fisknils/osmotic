import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { openSite, scrape, shop } from './helpers/index.js';

test('XPath-style indexes select the nth element of its type', async (t) => {
	const site = await openSite(t, shop);
	const { rows } = await scrape(Osmotic.get(site.url('/product/desk-lamp')).set({ colour: '.specs tr[2] td[2]' }));
	assert.deepEqual(rows, [{ colour: 'Black' }]);
});

test('brackets inside quoted strings are left alone', async (t) => {
	const site = await openSite(t, { '/': '<a href="/x[1]">quoted</a> <a href="/x">plain</a>' });
	const { rows } = await scrape(Osmotic.get(site.url('/')).set({ link: 'a[href="/x[1]"]' }));
	assert.deepEqual(rows, [{ link: 'quoted' }]);
});

test(':text-is() matches the exact trimmed text', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/product/desk-lamp')).set({
		power: 'td:text-is("Power") + td',
		partial: 'td:text-is("Pow") + td',
	});
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ power: '9 W', partial: '' }]);
});

test(':text-match() matches the trimmed text against a regex', async (t) => {
	const site = await openSite(t, shop);
	const { rows } = await scrape(
		Osmotic.get(site.url('/product/floor-lamp')).set({ power: 'td:text-match("^[0-9]+ W$")' }),
	);
	assert.deepEqual(rows, [{ power: '24 W' }]);
});

test('custom pseudos can be selector aliases or functions', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/category/lamps'))
		.config({
			pseudos: {
				sale: '.badge-sale',
				sku: (el, value) => el.attribs['data-sku'] === value,
			},
		})
		.set({ badge: ':sale', name: 'li:sku(DESK-LAMP) h2' });
	const { rows } = await scrape(chain);
	assert.deepEqual(rows, [{ badge: 'Sale', name: 'Desk lamp' }]);
});
