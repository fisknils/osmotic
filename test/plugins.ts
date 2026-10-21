import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic, type FetchMiddleware, type OsmoticPlugin } from '../src/index.cjs';
import { openSite, scrape, shop } from './helpers/index.js';

declare module '../src/osmotic.js' {
	interface Osmotic {
		pluginTestShout(): this;
		pluginTestFactory(): this;
		pluginTestDefault(): this;
		pluginTestGood(): this;
	}
}

const shout = (key: string) => () => (ctx: any, next: any) =>
	next({ ...ctx, data: { ...ctx.data, [key]: String(ctx.data[key]).toUpperCase() } });

test('a plugin adds commands, and its middleware to chains created afterwards', async (t) => {
	const site = await openSite(t, shop);
	const seen: string[] = [];
	const tag: FetchMiddleware = (req, next) => {
		seen.push(new URL(req.url).pathname);
		return next(req);
	};
	const before = Osmotic.get(site.url('/category/lamps'));
	assert.equal(
		Osmotic.plugins([{ name: 'plugin-test-shout', commands: { pluginTestShout: shout('h') }, fetch: [tag] }]),
		Osmotic,
	);
	await before.run();
	assert.deepEqual(seen, [], 'a chain created before loading does not get the middleware');
	const { rows } = await scrape(Osmotic.get(site.url('/')).set({ h: 'title' }).pluginTestShout());
	assert.deepEqual(rows, [{ h: 'GADGET SHOP' }]);
	assert.deepEqual(seen, ['/']);
});

test('a function plugin is called, and a default export is unwrapped', () => {
	Osmotic.plugins([
		() => ({ name: 'plugin-test-factory', commands: { pluginTestFactory: shout('x') } }),
		{
			default: { name: 'plugin-test-default', commands: { pluginTestDefault: shout('x') } },
		} as unknown as OsmoticPlugin,
	]);
	assert.equal(typeof new Osmotic().pluginTestFactory, 'function');
	assert.equal(typeof new Osmotic().pluginTestDefault, 'function');
});

test('loading the same plugin twice does nothing, another plugin with its name throws', () => {
	const plugin: OsmoticPlugin = { name: 'plugin-test-once' };
	Osmotic.plugins([plugin]);
	Osmotic.plugins([plugin, plugin]);
	assert.throws(() => Osmotic.plugins([{ name: 'plugin-test-once' }]), /"plugin-test-once" is already loaded/);
});

test('loading is all or nothing', () => {
	const good: OsmoticPlugin = { name: 'plugin-test-good', commands: { pluginTestGood: shout('x') } };
	const clash: OsmoticPlugin = { name: 'plugin-test-clash', commands: { find: shout('x') } };
	assert.throws(() => Osmotic.plugins([good, clash]), /command "find" already exists/);
	assert.equal(typeof new Osmotic().pluginTestGood, 'undefined');
	Osmotic.plugins([good]);
	assert.equal(typeof new Osmotic().pluginTestGood, 'function', 'the good plugin can still be loaded');
});

test('invalid plugins are rejected', () => {
	const bad = (value: unknown) => () => Osmotic.plugins([value as OsmoticPlugin]);
	assert.throws(bad(42), /Not an osmotic plugin/);
	assert.throws(bad({ commands: {} }), /Not an osmotic plugin/);
	assert.throws(bad({ name: 'p2', commands: { x: 'no' } }), /command "x" must be a function/);
	assert.throws(bad({ name: 'p3', fetch: () => {} }), /fetch must be an array/);
	assert.throws(() => Osmotic.plugins({} as unknown as OsmoticPlugin[]), /expects an array/);
});

// Known bug: an array passes the object check, so [fn] would register a command named "0"
test('commands given as an array are rejected', { todo: 'fix in a fix/ branch' }, () => {
	assert.throws(
		() => Osmotic.plugins([{ name: 'plugin-test-array', commands: [shout('x')] } as unknown as OsmoticPlugin]),
		/commands must be an object/,
	);
});
