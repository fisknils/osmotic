import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic, type Slot } from '../src/index.cjs';
import { openSite } from './helpers/index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pathOf = (url: string) => new URL(url).pathname;

// Run `body` as a step on a one-page site, and fail the test if it throws
async function inRun(t: { after(fn: () => unknown): void }, body: (chain: Osmotic) => Promise<unknown>, config = {}) {
	const site = await openSite(t, { '/': '<h1>Home</h1>' });
	const chain = Osmotic.get(site.url('/')).config(config);
	await chain.use((ctx, next) => body(chain).then(() => next(ctx))).run();
	return site;
}

test('inSlot() throws outside run()', async () => {
	await assert.rejects(
		new Osmotic().inSlot(() => 1),
		/inSlot\(\) can only be called while run\(\) is in progress/,
	);
});

test('inSlot() returns what fn returns, passes errors on and frees the slot when fn throws', async (t) => {
	await inRun(
		t,
		async (chain) => {
			assert.equal(await chain.inSlot(async (slot: Slot) => `slot ${slot.id}`), 'slot 0');
			await assert.rejects(
				chain.inSlot(() => {
					throw new Error('command failed');
				}),
				/command failed/,
			);
			assert.equal(await chain.inSlot(() => 'free again'), 'free again');
		},
		{ concurrency: 1 },
	);
});

test('inSlot() follows concurrency', async (t) => {
	let active = 0;
	let mostActive = 0;
	await inRun(
		t,
		(chain) =>
			Promise.all(
				Array.from({ length: 5 }, () =>
					chain.inSlot(async () => {
						mostActive = Math.max(mostActive, ++active);
						await sleep(20);
						active--;
					}),
				),
			),
		{ concurrency: 2 },
	);
	assert.equal(mostActive, 2);
});

test('inSlot() waits out the delay option and a slot delay', async (t) => {
	for (const config of [{ delay: 150 }, { delay: 0, slots: [{ delay: 150 }] }]) {
		let waited = 0;
		await inRun(
			t,
			async (chain) => {
				const started = Date.now();
				await chain.inSlot(() => void (waited = Date.now() - started));
			},
			config,
		);
		assert.ok(waited >= 140, `waited ${waited}ms with ${JSON.stringify(config)}`);
	}
});

test("inSlot() with a url waits out that site's Crawl-delay, shared with page loads", async (t) => {
	const site = await openSite(t, {
		'/robots.txt': { type: 'text/plain', body: 'User-agent: *\nCrawl-delay: 0.3\n' },
		'/': '<h1>Home</h1>',
		'/a': '<h1>A</h1>',
	});
	let ran = 0;
	const chain = Osmotic.get(site.url('/'));
	await chain
		.use((ctx, next) => chain.inSlot(() => void (ran = Date.now()), { url: site.url('/') }).then(() => next(ctx)))
		.get('/a')
		.run();
	const [home, a] = site.requests.filter((r) => r.path !== '/robots.txt').map((r) => r.at);
	assert.ok(ran - home >= 280, `ran ${ran - home}ms after the page load`);
	assert.ok(a - ran >= 280, `the next page load came ${a - ran}ms later`);
});

test('inSlot() waits for the slot it is given', async (t) => {
	let busyId = -1;
	let gotId = -2;
	let waited = 0;
	await inRun(
		t,
		async (chain) => {
			const busy = chain.inSlot((slot) => {
				busyId = slot.id;
				return sleep(100);
			});
			const other = await chain.inSlot((slot) => slot);
			assert.notEqual(other.id, busyId, 'the other slot is free');
			const started = Date.now();
			const wanted: Slot = { id: busyId };
			gotId = await chain.inSlot((slot) => slot.id, { slot: wanted });
			waited = Date.now() - started;
			await busy;
		},
		{ concurrency: 2 },
	);
	assert.equal(gotId, busyId);
	assert.ok(waited >= 50, `waited ${waited}ms for the busy slot while the other was free`);
});

test('inSlot() goes ahead of waiting page loads, unless given a lower priority', async (t) => {
	const site = await openSite(t, {
		'/': '<a href="/p1">1</a> <a href="/p2">2</a> <a href="/p3">3</a>',
		'/p1': { body: '<h1>1</h1>', wait: 30 },
		'/p2': { body: '<h1>2</h1>', wait: 30 },
		'/p3': { body: '<h1>3</h1>', wait: 30 },
	});
	for (const priority of [undefined, 0]) {
		const order: string[] = [];
		const chain = Osmotic.get(site.url('/'));
		await chain
			.follow()
			.on('page', (e) => void order.push(`page ${pathOf(e.url)}`))
			.use((ctx, next) =>
				chain
					.inSlot(() => void order.push(`slot ${pathOf(ctx.url!)}`), priority === undefined ? {} : { priority })
					.then(() => next(ctx)),
			)
			.config({ concurrency: 1 })
			.run();
		if (priority === undefined) {
			assert.ok(order.indexOf('slot /p1') < order.indexOf('page /p3'), `by default: ${order.join(', ')}`);
		} else {
			assert.ok(order.indexOf('slot /p1') > order.indexOf('page /p3'), `priority 0: ${order.join(', ')}`);
		}
	}
});

test('inSlot() does not count toward maxPages', async (t) => {
	const site = await openSite(t, { '/': '<h1>Home</h1>', '/a': '<h1>A</h1>' });
	const pages: string[] = [];
	const chain = Osmotic.get(site.url('/'));
	await chain
		.use(async (ctx, next) => {
			for (let i = 0; i < 3; i++) await chain.inSlot(() => {});
			return next(ctx);
		})
		.get('/a')
		.on('page', (e) => void pages.push(pathOf(e.url)))
		.config({ maxPages: 2 })
		.run();
	assert.deepEqual(pages, ['/', '/a']);
});
