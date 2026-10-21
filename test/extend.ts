import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic, type FetchMiddleware } from '../src/index.cjs';
import { news, openSite, scrape, shop, sortBy } from './helpers/index.js';

declare module '../src/core/Osmotic.js' {
	interface Osmotic {
		extendTestPause(ms: number): this;
		extendTestFirstLink(): this;
		host(): this;
	}
}

test('.use() steps can stop a branch, continue it, or split it', async (t) => {
	const site = await openSite(t, news);
	const chain = Osmotic.get(site.url('/'))
		.find('tr.athing')
		.set({ rank: '.rank' })
		.use(async (ctx, next) => {
			if (ctx.data.rank === '1.') return; // Stop
			if (ctx.data.rank === '2.') return next(ctx); // Continue
			await Promise.all([
				next({ ...ctx, data: { ...ctx.data, copy: 'a' } }),
				next({ ...ctx, data: { ...ctx.data, copy: 'b' } }),
			]);
		});
	const { rows } = await scrape(chain);
	assert.deepEqual(sortBy(rows, 'copy'), [{ rank: '3.', copy: 'a' }, { rank: '3.', copy: 'b' }, { rank: '2.' }]);
});

test('.useFetch() middleware runs in the order added and can change requests', async (t) => {
	const site = await openSite(t, shop);
	const order: string[] = [];
	const first: FetchMiddleware = (req, next) => {
		order.push(`first ${new URL(req.url).pathname} slot ${req.slot.id}`);
		return next({ ...req, headers: { ...req.headers, 'X-Added': 'by first' } });
	};
	const second: FetchMiddleware = (req, next) => {
		order.push(`second sees ${req.headers['X-Added']}`);
		return next(req);
	};
	await scrape(Osmotic.get(site.url('/')).useFetch(first).useFetch(second));
	assert.deepEqual(order, ['first / slot 0', 'second sees by first']);
	assert.equal(site.requests.find((r) => r.path === '/')?.headers['x-added'], 'by first');
});

test('middleware can answer without the network', async (t) => {
	const site = await openSite(t, shop);
	const offline: FetchMiddleware = async () =>
		new Response('<h1>From middleware</h1>', { headers: { 'content-type': 'text/html' } });
	const { rows, page } = await scrape(Osmotic.get(site.url('/')).useFetch(offline).set({ h: 'h1' }));
	assert.deepEqual(rows, [{ h: 'From middleware' }]);
	assert.equal(page[0].url, site.url('/'), 'a constructed response falls back to the requested URL');
	assert.deepEqual(site.paths(), ['/robots.txt'], 'robots.txt is still fetched directly');
});

test('middleware onStart and onEnd hooks run once per run', async (t) => {
	const site = await openSite(t, shop);
	const hooks: string[] = [];
	const mw: FetchMiddleware = Object.assign(
		(req: Parameters<FetchMiddleware>[0], next: Parameters<FetchMiddleware>[1]) => next(req),
		{
			onStart: () => void hooks.push('start'),
			onEnd: () => void hooks.push('end'),
		},
	);
	const chain = Osmotic.get(site.url('/')).follow('nav a').useFetch(mw);
	await chain.run();
	await chain.run();
	assert.deepEqual(hooks, ['start', 'end', 'start', 'end']);
});

test('Osmotic.command() adds a chainable method to every instance', async (t) => {
	const site = await openSite(t, shop);
	Osmotic.command(
		'extendTestPause',
		(ms: number) => (ctx, next) => new Promise((r) => setTimeout(r, ms)).then(() => next(ctx)),
	);
	const started = Date.now();
	const { rows } = await scrape(Osmotic.get(site.url('/')).extendTestPause(50).set({ title: 'title' }));
	assert.deepEqual(rows, [{ title: 'Gadget Shop' }]);
	assert.ok(Date.now() - started >= 45);
});

test('custom commands can use this.links() and this.fetchPage()', async (t) => {
	const site = await openSite(t, shop);
	Osmotic.command('extendTestFirstLink', function () {
		return async (ctx, next) => {
			const [url] = this.links(ctx, '.products a@href');
			const page = url ? await this.fetchPage(url) : null;
			if (page) await next({ ...ctx, ...page });
		};
	});
	const { rows } = await scrape(Osmotic.get(site.url('/category/lamps')).extendTestFirstLink().set({ name: 'h1' }));
	assert.deepEqual(rows, [{ name: 'Desk lamp' }]);
});

// The commands reach the instance through a private CommandHost; it must not take a name
// a plugin could register a command under
test('a command named host can be registered and called', async (t) => {
	const site = await openSite(t, shop);
	Osmotic.command('host', () => (ctx, next) => next({ ...ctx, data: { ...ctx.data, host: new URL(ctx.url!).host } }));
	const { rows } = await scrape(Osmotic.get(site.url('/')).host());
	assert.deepEqual(rows, [{ host: new URL(site.url('/')).host }]);
});

test('a command name that already exists is rejected', () => {
	assert.throws(() => Osmotic.command('find', () => (ctx, next) => next(ctx)), /already exists/);
});

test('fetchPage() only works during a run, and returns null for a URL already seen', async (t) => {
	const site = await openSite(t, shop);
	const chain = new Osmotic();
	await assert.rejects(chain.fetchPage(site.url('/')), /only be fetched while run\(\) is in progress/);
	const results: unknown[] = [];
	await chain
		.use(async (ctx, next) => {
			results.push((await chain.fetchPage(site.url('/')))?.url);
			results.push(await chain.fetchPage(site.url('/')));
			return next(ctx);
		})
		.run();
	assert.deepEqual(results, [site.url('/'), null]);
});
