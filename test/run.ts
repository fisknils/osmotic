import { test } from 'node:test';
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
	assert.ok(lines.includes('Done. Fetched 4 page(s).'));
	assert.ok(lines.includes('Skipped 2 URL(s) disallowed by robots.txt.'));
});
