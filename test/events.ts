import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { createSite, openSite, scrape, shop } from './helpers/index.js';

// The URL of a site that was closed, so requests to it fail
async function deadUrl(): Promise<string> {
	const site = await createSite({});
	await site.close();
	return site.url('/');
}

test('start handlers run before the first request, in order', async (t) => {
	const site = await openSite(t, shop);
	const order: string[] = [];
	const chain = Osmotic.get(site.url('/'))
		.on('start', async ({ osmotic }) => {
			await new Promise((r) => setTimeout(r, 10));
			order.push(`first, requests: ${site.requests.length}, same chain: ${osmotic === chain}`);
		})
		.on('start', () => {
			order.push('second');
		});
	await chain.run();
	assert.deepEqual(order, ['first, requests: 0, same chain: true', 'second']);
});

test('a start handler that throws aborts the run, and end still runs', async (t) => {
	const site = await openSite(t, shop);
	let end: unknown;
	const chain = Osmotic.get(site.url('/'))
		.on('start', () => {
			throw new Error('not today');
		})
		.on('end', (e) => (end = e.error));
	await assert.rejects(chain.run(), /not today/);
	assert.equal(site.requests.length, 0);
	assert.match(String(end), /not today/);
});

test('page events report the URL, status and timing', async (t) => {
	const site = await openSite(t, shop);
	const { page } = await scrape(Osmotic.get(site.url('/')));
	assert.equal(page.length, 1);
	const [{ url, requestedUrl, status, ms }] = page;
	assert.deepEqual({ url, requestedUrl, status }, { url: site.url('/'), requestedUrl: site.url('/'), status: 200 });
	assert.equal(typeof ms, 'number');
});

test('a failed request fires an error event instead of logging, and the run continues', async (t) => {
	const url = await deadUrl();
	const errorLog = t.mock.method(console, 'error', () => {});
	const { error, end } = await scrape(Osmotic.get(url));
	assert.equal(error.length, 1);
	assert.equal(error[0].url, url);
	assert.ok(error[0].error instanceof Error);
	assert.equal(errorLog.mock.callCount(), 0);
	assert.equal(end?.error, undefined, 'a failed request does not fail the run');
});

test('without an error handler, failed requests are logged', async (t) => {
	const url = await deadUrl();
	const errorLog = t.mock.method(console, 'error', () => {});
	await Osmotic.get(url).run();
	assert.equal(errorLog.mock.callCount(), 1);
	assert.match(String(errorLog.mock.calls[0].arguments[0]), new RegExp(`^Failed ${url}`));
});

test('end reports the run stats', async (t) => {
	const site = await openSite(t, shop);
	const { end } = await scrape(Osmotic.get(site.url('/')).follow('nav a'));
	assert.equal(end?.stats.pages, 4); // Home, two categories and the partner page
	assert.equal(end?.stats.robotsSkipped, 2);
	assert.deepEqual(end?.stats.rows, {});
	assert.equal('error' in end!, false);
});

test('every end handler runs, even after one throws', async (t) => {
	const site = await openSite(t, shop);
	const errorLog = t.mock.method(console, 'error', () => {});
	let second = false;
	await Osmotic.get(site.url('/'))
		.on('end', () => {
			throw new Error('broken handler');
		})
		.on('end', () => {
			second = true;
		})
		.run();
	assert.ok(second);
	assert.ok(errorLog.mock.calls.some((c) => String(c.arguments[0]).includes('broken handler')));
});

test('page handlers are not awaited, and their errors are logged without failing the run', async (t) => {
	const site = await openSite(t, shop);
	const errorLog = t.mock.method(console, 'error', () => {});
	let slowDone = false;
	await Osmotic.get(site.url('/'))
		.on('page', () => new Promise<void>((r) => setTimeout(() => r(void (slowDone = true)), 300)))
		.on('page', () => {
			throw new Error('page handler broke');
		})
		.run();
	assert.equal(slowDone, false, 'the run finished without waiting for the slow handler');
	assert.ok(errorLog.mock.calls.some((c) => String(c.arguments[0]).includes('page handler broke')));
});

test('.off() removes a handler', async (t) => {
	const site = await openSite(t, shop);
	let calls = 0;
	const handler = () => void calls++;
	await Osmotic.get(site.url('/')).on('page', handler).off('page', handler).run();
	assert.equal(calls, 0);
});
