import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic, type Data, type Exporter } from '../src/index.cjs';
import { news, openSite, scrape, shop } from './helpers/index.js';

// An export type that keeps what it is given in memory, so tests can see every call
interface MemoryExport {
	file: string;
	options: unknown;
	rows: Data[];
	ended: number;
}

function memoryType(type: string, overrides: (record: MemoryExport) => Partial<Exporter> = () => ({})) {
	const created: MemoryExport[] = [];
	Osmotic.exporter(type, (file, options) => {
		const record: MemoryExport = { file, options, rows: [], ended: 0 };
		created.push(record);
		return {
			write: (data) => void record.rows.push(data),
			end: () => void record.ended++,
			...overrides(record),
		};
	});
	return created;
}

// The ranks of the first news page, as one chain that reaches .export() three times
const ranks = (url: string) => Osmotic.get(url).find('tr.athing').set({ rank: '.rank' });

test('an unknown type throws when the chain is built, naming the way out', () => {
	assert.throws(
		() => new Osmotic().export('export-test-nope', 'out.x'),
		/No exporter for "export-test-nope".*Osmotic\.plugins\(\)/,
	);
});

test('the exporter is created on the first row, with the file and options, and gets every row', async (t) => {
	const site = await openSite(t, news);
	const created = memoryType('export-test-basic');
	const { rows } = await scrape(ranks(site.url('/')).export('export-test-basic', 'ranks.out', { pretty: true }));
	assert.equal(created.length, 1);
	const [exp] = created;
	assert.equal(exp.file, 'ranks.out');
	assert.deepEqual(exp.options, { pretty: true });
	assert.deepEqual(exp.rows.map((r) => r.rank).sort(), ['1.', '2.', '3.']);
	assert.equal(exp.ended, 1);
	assert.equal(rows.length, 3, 'the chain continues after .export()');
});

test('options are passed as undefined when left out', async (t) => {
	const site = await openSite(t, news);
	const created = memoryType('export-test-no-options');
	await scrape(ranks(site.url('/')).export('export-test-no-options', 'ranks.out'));
	assert.equal(created[0].options, undefined);
});

test('a run without rows creates no exporter, and the summary says so', async (t) => {
	const site = await openSite(t, news);
	const created = memoryType('export-test-empty');
	const log = t.mock.method(console, 'log', () => {});
	const { end } = await scrape(Osmotic.get(site.url('/')).find('.nothing').export('export-test-empty', 'empty.out'));
	assert.equal(created.length, 0);
	assert.deepEqual(end?.stats.rows, { 'empty.out': 0 });
	assert.ok(log.mock.calls.some((c) => c.arguments[0] === 'No rows for empty.out'));
});

test('a promise returned by write() is awaited before the branch continues', async (t) => {
	const site = await openSite(t, shop);
	const order: string[] = [];
	memoryType('export-test-async', () => ({
		write: async () => {
			await new Promise((r) => setTimeout(r, 30));
			order.push('written');
		},
	}));
	await Osmotic.get(site.url('/'))
		.set({ title: 'title' })
		.export('export-test-async', 'title.out')
		.data(() => {
			order.push('next step');
		})
		.run();
	assert.deepEqual(order, ['written', 'next step']);
});

test('end() runs once per run, also when a step fails', async (t) => {
	const site = await openSite(t, news);
	const created = memoryType('export-test-failing-step');
	const chain = ranks(site.url('/'))
		.export('export-test-failing-step', 'ranks.out')
		.use(() => {
			throw new Error('step failed');
		});
	await assert.rejects(chain.run(), /step failed/);
	assert.equal(created.length, 1);
	assert.equal(created[0].ended, 1);
});

test('an end() that fails fails the run, and the end event reports it', async (t) => {
	const site = await openSite(t, shop);
	memoryType('export-test-failing-end', () => ({ end: () => Promise.reject(new Error('disk full')) }));
	let endError: unknown;
	const chain = Osmotic.get(site.url('/'))
		.export('export-test-failing-end', 'home.out')
		.on('end', (e) => (endError = e.error));
	await assert.rejects(chain.run(), /disk full/);
	assert.match(String(endError), /disk full/);
});

test('after an earlier failure, that error is kept and a failing end() is logged', async (t) => {
	const site = await openSite(t, shop);
	memoryType('export-test-both-fail', () => ({ end: () => Promise.reject(new Error('disk full')) }));
	const errorLog = t.mock.method(console, 'error', () => {});
	let endError: unknown;
	const chain = Osmotic.get(site.url('/'))
		.export('export-test-both-fail', 'home.out')
		.use(() => {
			throw new Error('step failed');
		})
		.on('end', (e) => (endError = e.error));
	await assert.rejects(chain.run(), /step failed/);
	assert.match(String(endError), /step failed/);
	assert.ok(errorLog.mock.calls.some((c) => String(c.arguments[0]).includes('disk full')));
});

test('stats.rows counts rows per file, and every run starts a fresh exporter', async (t) => {
	const site = await openSite(t, news);
	const created = memoryType('export-test-runs');
	let stats: unknown;
	const chain = ranks(site.url('/'))
		.export('export-test-runs', 'all.out')
		.filter(($, node, data) => data.rank === '1.')
		.export('export-test-runs', 'first.out')
		.on('end', (e) => (stats = e.stats.rows));
	await chain.run();
	assert.deepEqual(stats, { 'all.out': 3, 'first.out': 1 });
	await chain.run();
	assert.deepEqual(stats, { 'all.out': 3, 'first.out': 1 }, 'counts start over');
	assert.deepEqual(
		created.map((c) => [c.file, c.rows.length, c.ended]),
		[
			['all.out', 3, 1],
			['first.out', 1, 1],
			['all.out', 3, 1],
			['first.out', 1, 1],
		],
	);
});

test('Osmotic.exporter() throws for a type that already exists', () => {
	memoryType('export-test-taken');
	assert.throws(() => memoryType('export-test-taken'), /exporter "export-test-taken" already exists/);
});
