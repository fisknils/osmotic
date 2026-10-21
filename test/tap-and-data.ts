import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { openSite, scrape, shop } from './helpers/index.js';

test('.tap() logs the label and URL of every branch, then continues', async (t) => {
	const site = await openSite(t, shop);
	const log = t.mock.method(console, 'log', () => {});
	const { rows } = await scrape(
		Osmotic.get(site.url('/category/lamps')).tap().get('?page=2').tap('page 2').set({ h: 'h1' }),
	);
	const lines = log.mock.calls.map((c) => c.arguments[0]);
	assert.ok(lines.includes(`[tap] ${site.url('/category/lamps')}`));
	assert.ok(lines.includes(`[page 2] ${site.url('/category/lamps?page=2')}`));
	assert.deepEqual(rows, [{ h: 'Lamps' }]);
});

test('.data() gets the data and the context, and an async callback is awaited', async (t) => {
	const site = await openSite(t, shop);
	const order: string[] = [];
	const chain = Osmotic.get(site.url('/product/desk-lamp'))
		.set({ name: 'h1' })
		.data(async (data, ctx) => {
			await new Promise((r) => setTimeout(r, 20));
			order.push(`${data.name} at ${ctx.url}`);
		})
		.data(() => {
			order.push('next step');
		});
	await scrape(chain);
	assert.deepEqual(order, [`Desk lamp at ${site.url('/product/desk-lamp')}`, 'next step']);
});
