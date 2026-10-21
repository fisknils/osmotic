import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Osmotic } from '../src/index.cjs';
import { createSite } from './helpers/index.js';

test('serves an HTML string with status 200', async () => {
	const site = await createSite({ '/': '<h1>Home</h1>' });
	try {
		const res = await fetch(site.url('/'));
		assert.equal(res.status, 200);
		assert.equal(res.headers.get('content-type'), 'text/html');
		assert.equal(await res.text(), '<h1>Home</h1>');
	} finally {
		await site.close();
	}
});

test('serves an object with its status, type, headers and body', async () => {
	const site = await createSite({
		'/feed': { status: 201, type: 'application/json', body: '{}', headers: { 'x-test': 'yes' } },
	});
	try {
		const res = await fetch(site.url('/feed'));
		assert.equal(res.status, 201);
		assert.equal(res.headers.get('content-type'), 'application/json');
		assert.equal(res.headers.get('x-test'), 'yes');
		assert.equal(await res.text(), '{}');
	} finally {
		await site.close();
	}
});

test('redirects with 302 unless another status is given', async () => {
	const site = await createSite({
		'/old': { redirect: '/new' },
		'/moved': { redirect: '/new', status: 301 },
		'/new': 'new',
	});
	try {
		const old = await fetch(site.url('/old'), { redirect: 'manual' });
		assert.equal(old.status, 302);
		assert.equal(old.headers.get('location'), '/new');
		assert.equal((await fetch(site.url('/moved'), { redirect: 'manual' })).status, 301);
		assert.equal(await (await fetch(site.url('/old'))).text(), 'new');
	} finally {
		await site.close();
	}
});

test('returns 404 for paths without an entry, including /robots.txt', async () => {
	const site = await createSite({ '/': 'home' });
	try {
		assert.equal((await fetch(site.url('/missing'))).status, 404);
		assert.equal((await fetch(site.url('/robots.txt'))).status, 404);
	} finally {
		await site.close();
	}
});

test('records each request with its path, host and headers, in order', async () => {
	const site = await createSite({ '/': 'home', '/a?x=1': 'a' });
	try {
		await fetch(site.url('/'), { headers: { 'user-agent': 'first' } });
		await fetch(site.url('/a?x=1'));
		assert.deepEqual(site.paths(), ['/', '/a?x=1']);
		assert.equal(site.requests[0].headers['user-agent'], 'first');
		assert.equal(site.requests[0].host, new URL(site.origin).host);
	} finally {
		await site.close();
	}
});

test('is reachable under a second hostname', async () => {
	const site = await createSite({ '/': 'home' });
	try {
		assert.notEqual(new URL(site.origin).hostname, new URL(site.otherOrigin).hostname);
		assert.equal(await (await fetch(site.otherOrigin + '/')).text(), 'home');
		assert.equal(site.requests[0].host, new URL(site.otherOrigin).host);
	} finally {
		await site.close();
	}
});

test('serves a multi-page site to a chain', async () => {
	const site = await createSite({
		'/': '<a href="/a">A</a> <a href="/b">B</a>',
		'/a': '<h1>A</h1>',
		'/b': '<h1>B</h1>',
	});
	try {
		const titles: unknown[] = [];
		await Osmotic.get(site.url('/'))
			.follow()
			.set({ title: 'h1' })
			.data((d) => titles.push(d.title))
			.run();
		assert.deepEqual(titles.sort(), ['A', 'B']);
		assert.deepEqual(site.paths().slice(0, 2), ['/robots.txt', '/']);
		assert.deepEqual(site.paths().slice(2).sort(), ['/a', '/b']); // Fetched concurrently
	} finally {
		await site.close();
	}
});
