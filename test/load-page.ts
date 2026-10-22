import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { openSite, scrape } from './helpers/index.js';

test('loadPage() parses HTML with the built-in pseudo-classes and the pseudos option', () => {
	const chain = new Osmotic().config({ pseudos: { sale: '.badge-sale' } });
	const page = chain.loadPage(
		'<p>Lamp</p><p class="badge-sale">Charger</p><td>Price</td><td>99</td>',
		'https://example.com/shop',
	);
	assert.equal(page.$('p:contains("Lamp")').length, 1);
	assert.equal(page.$('td:text-is("Price") + td').text(), '99');
	assert.equal(page.$('p:sale').text(), 'Charger');
	assert.equal(page.url, 'https://example.com/shop');
	assert.equal(page.base, 'https://example.com/shop');
	assert.equal(page.$(page.node).find('p').length, 2, 'node is the document root');
	assert.equal('attached' in page, false, 'no attached key, so spreading it keeps the current one');
});

test('loadPage() takes the base from <base href>', () => {
	const page = new Osmotic().loadPage('<base href="/blog/"><a href="post">Post</a>', 'https://example.com/a/b');
	assert.equal(page.base, 'https://example.com/blog/');
});

test('loadPage() fires no page event and leaves maxPages and stats.pages alone', async (t) => {
	const site = await openSite(t, { '/': '<h1>Home</h1>', '/a': '<h1>A</h1>' });
	const chain = Osmotic.get(site.url('/'));
	chain
		.use((ctx, next) => {
			for (let i = 0; i < 3; i++) chain.loadPage('<h1>Loaded</h1>', site.url(`/loaded-${i}`));
			return next(ctx);
		})
		.get('/a')
		.set({ h: 'h1' })
		.config({ maxPages: 2 });
	const { rows, page, skip, end } = await scrape(chain);
	assert.deepEqual(rows, [{ h: 'A' }]);
	assert.equal(page.length, 2);
	assert.deepEqual(skip, []);
	assert.equal(end?.stats.pages, 2);
});
