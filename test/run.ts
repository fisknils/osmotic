import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { openSite, shop } from './helpers/index.js';

test('a step that throws fails the run, and end reports the error', async (t) => {
	const site = await openSite(t, shop);
	let endError: unknown;
	const chain = Osmotic.get(site.url('/'))
		.use(() => {
			throw new Error('sync failure');
		})
		.on('end', (e) => (endError = e.error));
	await assert.rejects(chain.run(), /sync failure/);
	assert.match(String(endError), /sync failure/);
});

test('an async step that rejects fails the run', async (t) => {
	const site = await openSite(t, shop);
	await assert.rejects(
		Osmotic.get(site.url('/'))
			.use(async () => {
				throw new Error('async failure');
			})
			.run(),
		/async failure/,
	);
});

test('every run starts fresh, so URLs are fetched again', async (t) => {
	const site = await openSite(t, shop);
	const chain = Osmotic.get(site.url('/')).follow('nav a');
	await chain.run();
	const first = site.paths().filter((p) => p !== '/robots.txt').length;
	await chain.run();
	assert.equal(site.paths().filter((p) => p !== '/robots.txt').length, first * 2);
});

test('run() logs a summary', async (t) => {
	const site = await openSite(t, shop);
	const log = t.mock.method(console, 'log', () => {});
	await Osmotic.get(site.url('/')).follow('nav a').run();
	const lines = log.mock.calls.map((c) => c.arguments[0]);
	assert.ok(lines.some((l) => /^Done\. Fetched 4 page\(s\) in \d+ ms, \d+ ms per page on average\.$/.test(l)));
	assert.ok(lines.includes('Skipped 2 URL(s) disallowed by robots.txt.'));
});

// Date is mocked, so time passes only where a test ticks it: in the fetch middleware,
// per page, or in a start handler, outside any page load
async function timedRun(t: TestContext, path: string, pageMs: Record<string, number>, startMs = 0) {
	const site = await openSite(t, {
		'/': '<a href="/a">A</a><a href="/b">B</a>',
		'/a': '<h1>A</h1>',
		'/b': '<h1>B</h1>',
	});
	t.mock.timers.enable({ apis: ['Date'], now: 0 });
	const log = t.mock.method(console, 'log', () => {});
	await Osmotic.get(site.url(path))
		.follow('a')
		.config({ concurrency: 1 })
		.useFetch((req, next) => {
			t.mock.timers.tick(pageMs[new URL(req.url).pathname] ?? 0);
			return next(req);
		})
		.on('start', () => t.mock.timers.tick(startMs))
		.run();
	return log.mock.calls.map((c) => c.arguments[0]).find((l) => String(l).startsWith('Done.'));
}

test('the summary gives the total time and the average page load time', async (t) => {
	const line = await timedRun(t, '/', { '/': 100, '/a': 200, '/b': 300 });
	assert.equal(line, 'Done. Fetched 3 page(s) in 600 ms, 200 ms per page on average.');
});

test('the average is over page load times, not the total time, which is given in seconds from 1 s', async (t) => {
	const line = await timedRun(t, '/', { '/': 100, '/a': 200, '/b': 300 }, 900);
	assert.equal(line, 'Done. Fetched 3 page(s) in 1.5 s, 200 ms per page on average.');
});

test('without pages the summary has no average, and gives a minute or more in minutes', async (t) => {
	const line = await timedRun(t, '/missing', {}, 125_000);
	assert.equal(line, 'Done. Fetched 0 page(s) in 2 min 5 s.');
});
