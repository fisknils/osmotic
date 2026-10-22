import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic, type FetchMiddleware, type FetchRequest } from '../src/index.cjs';
import { archive, archiveArticle, archivePage, openSite, scrape } from './helpers/index.js';

declare module '../src/core/Osmotic.js' {
	interface Osmotic {
		releaseTestLoad(path: string): this;
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;

// Fetch middleware that attaches each page's path and records when the page is released.
// `events` gets a `release <path>` entry per release, so tests can add their own entries
// to see the order.
function releases(events: string[] = []) {
	const released: string[] = [];
	const open = new Set<string>();
	let mostOpen = 0;
	const middleware: FetchMiddleware = (req, next) => {
		const path = pathOf(req.url);
		req.attach!('path', path);
		open.add(path);
		mostOpen = Math.max(mostOpen, open.size);
		req.onRelease!(() => {
			open.delete(path);
			released.push(path);
			events.push(`release ${path}`);
		});
		return next(req);
	};
	return {
		middleware,
		released,
		open,
		mostOpen: () => mostOpen,
		isReleased: (path: string) => released.includes(path),
	};
}

// Load a page with the public fetchPage() and continue on it
Osmotic.command('releaseTestLoad', function (path: string) {
	return (ctx, next) =>
		this.fetchPage(new URL(path, ctx.url).href).then((page) => (page ? next({ ...ctx, ...page }) : undefined));
});

Osmotic.exporter('release-test-slow', (file, options: { wait: (n: number) => Promise<void> }) => ({
	write: (row) => options.wait(Number(row.n)),
	end: () => {},
}));

test('a recurse() crawl keeps at most two pages unreleased, and releases every page by the end', async (t) => {
	const site = await openSite(t, archive({ pages: 30, padding: 1000 }));
	const r = releases();
	await Osmotic.get(site.url(archivePage(1)))
		.useFetch(r.middleware)
		.recurse('a.older@href')
		.use(async (ctx, next) => {
			await sleep(20);
			return next(ctx);
		})
		.run();
	assert.equal(r.released.length, 30);
	assert.equal(r.open.size, 0, 'no page is left unreleased');
	assert.ok(r.mostOpen() <= 2, `${r.mostOpen()} pages were unreleased at once`);
});

// A listing of three items, and a slow page loaded alongside it
const listing = {
	'/': '<a href="/list">List</a> <a href="/slow">Slow</a>',
	'/list': '<p>1</p><p>2</p><p>3</p>',
	'/slow': { body: '<div>Slow</div>', wait: 300 },
};

// Steps that keep each branch from find() busy for wait(n), where n is the item's number
const holders: [string, (chain: Osmotic, wait: (n: number) => Promise<void>) => Osmotic][] = [
	['an async filter()', (c, wait) => c.filter(async ($, node) => (await wait(Number($(node).text())), true))],
	['data()', (c, wait) => c.set({ n: '' }).data((d) => wait(Number(d.n)))],
	['export()', (c, wait) => c.set({ n: '' }).export('release-test-slow', 'unused', { wait })],
	[
		'a custom step',
		(c, wait) =>
			c.use(async (ctx, next) => {
				await wait(Number(ctx.$!(ctx.node!).text()));
				return next(ctx);
			}),
	],
];

for (const [name, hold] of holders) {
	test(`a page is held while ${name} on a branch from find() works on it, and released after the last`, async (t) => {
		const site = await openSite(t, listing);
		const events: string[] = [];
		const r = releases(events);
		const seen: boolean[] = [];
		const wait = async (n: number) => {
			await sleep(n * 20);
			seen.push(r.isReleased('/list'));
		};
		const chain = hold(Osmotic.get(site.url('/')).useFetch(r.middleware).follow('a').find('p'), wait).on(
			'page',
			(e) => void events.push(`page ${pathOf(e.url)}`),
		);
		await chain.run();
		assert.deepEqual(seen, [false, false, false], 'not released while a branch is still on it');
		assert.ok(
			events.indexOf('release /list') < events.indexOf('page /slow'),
			`released once its branches finished, not at the end of the run: ${events.join(', ')}`,
		);
	});
}

test('a page stays held after a loadPage() result is spread over it', async (t) => {
	const site = await openSite(t, { '/': '<h1>Before</h1>' });
	const r = releases();
	const seen: unknown[] = [];
	const chain = new Osmotic();
	await chain
		// Keeps the run going while the branches below finish on their own
		.use((ctx, next) => Promise.all([next(ctx), sleep(150)]).then(() => {}))
		.get(site.url('/'))
		.useFetch(r.middleware)
		// Continues without waiting, so this step doesn't hold the page itself
		.use((ctx, next) => {
			void next({ ...ctx, ...chain.loadPage('<p>1</p><p>2</p>', ctx.url!) });
			return Promise.resolve();
		})
		.find('p')
		.data(async (d, ctx) => {
			await sleep(30);
			seen.push([ctx.attached?.path, r.isReleased('/')]);
		})
		.run();
	assert.deepEqual(seen, [
		['/', false],
		['/', false],
	]);
	assert.deepEqual(r.released, ['/']);
});

test('get() and follow() let go of the page they leave', async (t) => {
	const site = await openSite(t, archive({ pages: 1, articles: 5, padding: 1000 }));
	for (const leave of [(c: Osmotic) => c.get(archiveArticle(1, 0)), (c: Osmotic) => c.follow('article a@href')]) {
		const r = releases();
		const seen: boolean[] = [];
		await leave(Osmotic.get(site.url(archivePage(1))).useFetch(r.middleware))
			.use(async (ctx, next) => {
				await sleep(10);
				seen.push(r.isReleased(archivePage(1)));
				return next(ctx);
			})
			.config({ concurrency: 1 })
			.run();
		assert.ok(seen.length > 0 && seen.every(Boolean), `listing released while its linked pages run: ${seen}`);
	}
});

test('pages that are skipped or fail are released right away', async (t) => {
	const site = await openSite(t, {
		'/': '<a href="/gone">Gone</a> <a href="/pdf">PDF</a> <a href="/broken">Broken</a> <a href="/ok">OK</a>',
		'/gone': { status: 410 },
		'/pdf': { type: 'application/pdf', body: '%PDF' },
		'/broken': '<h1>Broken</h1>',
		'/ok': '<h1>OK</h1>',
	});
	const r = releases();
	const failing: FetchMiddleware = (req, next) => {
		if (pathOf(req.url) === '/broken') throw new Error('middleware failed');
		return next(req);
	};
	let seen: string[] = [];
	await Osmotic.get(site.url('/'))
		.useFetch(r.middleware)
		.useFetch(failing)
		.on('error', () => {})
		.follow('a')
		.use(async (ctx, next) => {
			await sleep(10);
			seen = [...r.released];
			return next(ctx);
		})
		.config({ concurrency: 1 })
		.run();
	assert.deepEqual(seen.sort(), ['/', '/broken', '/gone', '/pdf']);
});

test('pages from fetchPage() carry attached values and are released when the run ends', async (t) => {
	const site = await openSite(t, { '/': '<h1>Home</h1>', '/a': '<h1>A</h1>', '/b': '<h1>B</h1>' });
	const r = releases();
	const seen: unknown[] = [];
	let atEnd: boolean | undefined;
	await Osmotic.get(site.url('/'))
		.useFetch(r.middleware)
		.releaseTestLoad('/a')
		.use((ctx, next) => (seen.push(ctx.attached?.path), next(ctx)))
		.get('/b')
		.use(async (ctx, next) => {
			await sleep(30);
			seen.push(r.isReleased('/a'));
			return next(ctx);
		})
		.on('end', () => void (atEnd = r.isReleased('/a')))
		.run();
	assert.deepEqual(seen, ['/a', false]);
	assert.equal(atEnd, true);
});

test('attached values never reach the next page', async (t) => {
	const site = await openSite(t, { '/': '<a href="/next">Next</a>', '/next': '<h1>Next</h1>' });
	const onlyHome: FetchMiddleware = (req, next) => {
		if (pathOf(req.url) === '/') req.attach!('home', true);
		return next(req);
	};
	const chains: [string, (c: Osmotic) => Osmotic][] = [
		['get()', (c) => c.get('/next')],
		['follow()', (c) => c.follow()],
		['recurse()', (c) => c.recurse()],
		['a spread fetchPage() result', (c) => c.releaseTestLoad('/next')],
	];
	for (const [name, leave] of chains) {
		const seen: Record<string, unknown> = {};
		await leave(Osmotic.get(site.url('/')).useFetch(onlyHome))
			.use((ctx, next) => {
				assert.ok(Object.isFrozen(ctx.attached), 'attached is frozen');
				seen[pathOf(ctx.url!)] = ctx.attached;
				return next(ctx);
			})
			.run();
		assert.deepEqual(seen['/next'], {}, name);
		if (name === 'recurse()') assert.deepEqual(seen['/'], { home: true });
	}
});

test('when middleware calls next() more than once, attach() overwrites and every callback runs once', async (t) => {
	const site = await openSite(t, { '/': '<h1>Home</h1>' });
	const calls: string[] = [];
	const retry: FetchMiddleware = async (req, next) => {
		req.attach!('attempt', 1);
		req.onRelease!(() => void calls.push('first'));
		await next(req);
		req.attach!('attempt', 2);
		req.onRelease!(() => void calls.push('second'));
		return next(req);
	};
	const attached: unknown[] = [];
	await Osmotic.get(site.url('/'))
		.useFetch(retry)
		.use((ctx, next) => (attached.push(ctx.attached), next(ctx)))
		.run();
	assert.deepEqual(attached, [{ attempt: 2 }]);
	assert.deepEqual(calls.sort(), ['first', 'second']);
});

test('attach() and onRelease() work through next({ ...req, url }), and throw once the middleware returned', async (t) => {
	const site = await openSite(t, { '/old': '<h1>Old</h1>', '/new': '<h1>New</h1>' });
	const calls: string[] = [];
	let saved: FetchRequest | undefined;
	const rewrite: FetchMiddleware = (req, next) => next({ ...req, url: req.url.replace('/old', '/new') });
	const later: FetchMiddleware = (req, next) => {
		saved = req;
		req.attach!('via', 'later');
		req.onRelease!(() => void calls.push('later'));
		return next(req);
	};
	const rows: unknown[] = [];
	await Osmotic.get(site.url('/old'))
		.useFetch(rewrite)
		.useFetch(later)
		.use((ctx, next) => {
			rows.push([ctx.attached, ctx.$!('h1').text()]);
			assert.throws(() => saved!.attach!('late', true), /until the fetch middleware returns/);
			assert.throws(() => saved!.onRelease!(() => {}), /until the fetch middleware returns/);
			return next(ctx);
		})
		.run();
	assert.deepEqual(rows, [[{ via: 'later' }, 'New']]);
	assert.deepEqual(calls, ['later']);
});

test('a release callback that throws or rejects is logged, and the run goes on', async (t) => {
	const site = await openSite(t, { '/': '<h1>Home</h1>' });
	const calls: string[] = [];
	const mw: FetchMiddleware = (req, next) => {
		req.onRelease!(() => {
			throw new Error('sync cleanup failure');
		});
		req.onRelease!(async () => {
			throw new Error('async cleanup failure');
		});
		req.onRelease!(() => void calls.push('third'));
		return next(req);
	};
	const error = t.mock.method(console, 'error', () => {});
	const { rows } = await scrape(Osmotic.get(site.url('/')).useFetch(mw).set({ h: 'h1' }));
	assert.deepEqual(rows, [{ h: 'Home' }]);
	assert.deepEqual(calls, ['third']);
	const logged = error.mock.calls.map((c) => String(c.arguments[0])).join('\n');
	assert.match(logged, /sync cleanup failure/);
	assert.match(logged, /async cleanup failure/);
});

test('every release callback has settled before end handlers run, also when a step throws', async (t) => {
	const site = await openSite(t, { '/list': '<p>1</p><p>2</p><p>3</p>' });
	const settled: string[] = [];
	const mw: FetchMiddleware = (req, next) => {
		req.onRelease!(async () => {
			await sleep(50);
			settled.push(pathOf(req.url));
		});
		return next(req);
	};
	let atEnd: string[] = [];
	const chain = Osmotic.get(site.url('/list'))
		.useFetch(mw)
		.find('p')
		.use(async (ctx, next) => {
			if (ctx.$!(ctx.node!).text() === '1') throw new Error('step failed');
			await sleep(200); // The other branches are still on the page when the run fails
			return next(ctx);
		})
		.on('end', () => void (atEnd = [...settled]));
	await assert.rejects(chain.run(), /step failed/);
	assert.deepEqual(atEnd, ['/list']);
});
