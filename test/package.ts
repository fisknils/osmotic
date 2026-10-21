// Runs against the build in dist/, the only place the two entry points can be checked together
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('require and import of the build share one Osmotic class', async () => {
	const cjs: { Osmotic: unknown } = require('../dist/index.cjs');
	const esm: { Osmotic: unknown } = await import('../dist/index.mjs');
	assert.equal(typeof cjs.Osmotic, 'function');
	assert.equal(esm.Osmotic, cjs.Osmotic);
});
