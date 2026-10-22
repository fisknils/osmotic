# osmotic

A small, chainable web scraper for Node.js. Describe a crawl as a chain of steps
(load a page, find elements, extract fields, follow links, and so on), then
`run()` it. Pages are parsed with [cheerio](https://cheerio.js.org/), so selectors
are plain CSS with a few additions.

Inspired by [node-osmosis](https://github.com/rchipka/node-osmosis).

```js
const { Osmotic } = require('osmotic');

Osmotic.plugins([require('osmotic-plugin-csv')]);

Osmotic.get('https://news.ycombinator.com')
	.recurse('a[rel="next"]@href')
	.find('tr.athing')
	.set({ rank: '.rank', title: '.titleline > a', link: '.titleline > a@href' })
	.export('csv', 'hacker-news.csv')
	.config({ maxPages: 20 })
	.run();
```

- Fluent chain API, with branching built in: `find()` and `follow()` continue once per match
- Extraction specs for text, attributes, lists and nested objects; URLs come back absolute
- Respects `robots.txt` and `Crawl-delay` by default
- Concurrency limits, per-request delays, and per-slot proxies, user agents and headers
- Exports to files through pluggable exporters, such as [CSV](https://www.npmjs.com/package/osmotic-plugin-csv)
- Extensible through custom steps, fetch middleware, reusable commands and plugins
- Written in TypeScript; ships ESM and CommonJS entry points with type declarations

Requires Node.js 18 or later (it uses the built-in `fetch`).

## Installation

```sh
npm install osmotic
npm install osmotic-plugin-csv   # to export CSV files
```

The package ships prebuilt in `dist/` and runs no install scripts.

```js
// CommonJS
const { Osmotic } = require('osmotic');

// ES modules / TypeScript
import { Osmotic } from 'osmotic';
```

## How a chain works

Each command adds a step. When you call `run()`, a context object flows through the
steps in order:

| Field  | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| `data` | Fields collected so far (starts as `{}`)                         |
| `$`    | The cheerio instance for the current page                        |
| `node` | The current element (the document root right after a page loads) |
| `url`  | The current page URL (after redirects)                           |
| `base` | Base for relative links: `<base href>` if present, else `url`    |

A step can stop the branch, continue it, or split it. For example, `find("li")`
continues once per `<li>`, so every step after it runs once per list item, and the
branches run concurrently.

Each URL is fetched at most once per run, no matter how many steps lead to it.

When requests are waiting for a free slot, those from later steps in the chain go
first. A crawl therefore finishes the pages it has already found, such as the
items on a listing page, before it moves on to more listing pages. Results arrive
steadily and memory stays flat on large sites.

## Commands

### `Osmotic.get(url)` / `.get(url)`

Loads a page. Relative URLs resolve against the current page, so `.get("/about")`
works mid-chain.

### `.find(selector)`

Continues the chain once for each element matching `selector` inside the current
node.

### `.set(fields)`

Extracts values relative to the current node and merges them into `data`. Each
value is a [spec](#extraction-specs).

```js
.set({
	title: 'h1',
	image: 'meta[property="og:image"]@content',
	tags: ['.tag'],
	price: { amount: '.price .value', currency: '.price .currency' },
})
```

### `.filter(test)`

Continues only if `test` passes:

- **Selector string:** passes when the current node contains a match.
- **Function** `($, node, data) => boolean | Promise<boolean>`: passes when it returns true.

```js
const isProductPage = ($) =>
	$('script[type="application/ld+json"]').text().includes('"Product"');

.filter(isProductPage)
```

### `.follow(spec = "a@href")`

Loads every URL found by `spec` and continues the chain on each page. Data
collected so far carries over to the new pages. Only `http(s)` links are followed,
and `#fragments` are dropped.

### `.recurse(spec = "a@href", { sameDomain = true, exclude = [] })`

Runs the rest of the chain on the current page, then follows the links found by
`spec` and repeats on every new page. Together with the once-per-URL rule, this
crawls a whole site.

- `sameDomain`: only follow links on the current page's hostname.
- `exclude`: an array of regexes; links whose **pathname** matches any of them are skipped.

```js
Osmotic.get('https://example.com/')
	.recurse('a:not([rel~="nofollow"])@href', { exclude: [/^\/checkout\//] })
	.filter(isProductPage)
	.set({ title: 'h1' })
	.export('csv', 'products.csv')
	.config({ maxPages: 500 })
	.run();
```

### `.tap(label = "tap")`

Logs `[label] <url>` for every branch that reaches this step, then continues
unchanged. Handy for watching a crawl's progress or checking which pages a chain
reaches.

### `.data(callback)`

Calls `callback(data, ctx)` with the collected data, then continues. It may be async.

### `.export(type, file, options?)`

Writes each `data` object reaching this step to `file`, in the format of export
`type`. What `options` accepts depends on the type. The file is created when the first
row of a run arrives, so a run without rows creates no file.

osmotic has no export types of its own. They come from [plugins](#plugins), so load
one before building the chain, or `export()` throws:

```js
Osmotic.plugins([require('osmotic-plugin-csv')]);

Osmotic.get('https://example.com/products')
	.find('.product')
	.set({ name: 'h2', price: '.price' })
	.export('csv', 'products.csv', { delimiter: ',' })
	.run();
```

The type is given separately rather than read from the file extension, so a plugin can
offer its own take on a format under a new type name, such as `'csv-excel'`, and files
can have any name. To write rows somewhere other than a file, use `.data()`, or
[register an export type](#export-types-osmoticexportertype-factory).

### `.config(options)`

Merges [options](#options) into the current ones. It can be called anywhere in the chain.

### `.run()`

Runs the chain and returns a promise that resolves when every branch is done.
Exports are flushed and closed before it resolves, also when the run fails. `run()` logs a short summary
to the console.

## Extraction specs

Specs are used by `set()`, and the string form by `follow()` and `recurse()`.

| Spec                               | Result                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| `"selector"`                       | Trimmed text of the first match                                    |
| `"selector@attr"`                  | Attribute of the first match                                       |
| `"@attr"`                          | Attribute of the current node itself                               |
| `""`                               | Text of the current node itself                                    |
| `["selector"]`                     | Array of the text of every match                                   |
| `["selector@attr"]`                | Array of the attribute of every match (missing attributes skipped) |
| `["selector", { key: spec, ... }]` | Array of objects, one per match, each spec resolved relative to it |
| `{ key: spec, ... }`               | Nested object, each spec resolved relative to the node             |

The list form captures several groups of repeated items from one page into one row,
where `find()` could only split the chain on one of them:

```js
.set({
	name: 'h1',
	offers: ['#offers .offer', { seller: '.seller', price: '.price' }],
	specs: ['#specs tr', { label: 'td[1]', value: 'td[2]' }],
})
// { name: 'Desk lamp', offers: [{ seller: 'Lampbutiken', price: '479 SEK' }, ...], specs: [...] }
```

The specs inside the object can take any form, including another list. The list's own
selector takes the [selector extras](#selector-extras), but no `@attr`, since each match
is the node its specs resolve against.

With `resolveUrls` on (the default), URL attributes come back absolute:
`href`, `src`, `action`, `formaction`, `poster`, `cite`, `background`, `longdesc`
and `data`. Each candidate in a `srcset` is resolved too.

### Selector extras

On top of standard CSS selectors, osmotic supports:

- **XPath-style indexes:** `span[2]` means `span:nth-of-type(2)`. Brackets inside
  quoted strings are left alone.
- **`:text-is("…")`:** the element's trimmed text equals the value exactly, e.g.
  `td:text-is("Price") + td`.
- **`:text-match("…")`:** the element's trimmed text matches a regex, e.g.
  `span:text-match("^[0-9]+ W$")`. Write `[0-9]` rather than `\d`, since backslashes
  don't survive the selector parser.

You can add your own pseudo-classes with the `pseudos` option. Each one is either a
selector alias or a function `(element, argument) => boolean`:

```js
.config({
	pseudos: {
		sale: '.badge-sale',
		long: (el) => el.children.length > 10,
	},
})
```

## Options

| Option              | Default         | Description                                                      |
| ------------------- | --------------- | ---------------------------------------------------------------- |
| `concurrency`       | `4`             | Maximum parallel requests. Ignored when `slots` is set.          |
| `maxPages`          | `100`           | Maximum number of fetch attempts per run.                        |
| `delay`             | `0`             | Milliseconds to wait before each request.                        |
| `userAgent`         | `"osmotic/0.1"` | `User-Agent` header.                                             |
| `headers`           | `{}`            | Extra headers for every request.                                 |
| `slots`             | `null`          | Per-slot settings, see below.                                    |
| `respectRobots`     | `true`          | Skip URLs disallowed by the site's `robots.txt`.                 |
| `respectCrawlDelay` | `true`          | Space requests to a site by its `Crawl-delay`, across all slots. |
| `robotsUserAgent`   | `null`          | User agent to match in `robots.txt`. Defaults to `userAgent`.    |
| `resolveUrls`       | `true`          | Return URL attributes from `set()` as absolute URLs.             |
| `pseudos`           | `{}`            | Custom selector pseudo-classes.                                  |

Only HTML responses with a 2xx status continue the chain. Other responses and
network errors end that branch; network errors are also logged, unless an
[`error` handler](#events) is registered.

### Slots: proxies and per-request identities

Requests run through a fixed pool of slots. By default there are `concurrency`
identical slots. Pass `slots` to configure each one; any field left out falls back
to the global option:

```js
.config({
	slots: [
		{ proxy: 'http://proxy1:8080', userAgent: 'Agent A', delay: 500 },
		{ proxy: 'http://proxy2:8080', headers: { 'Accept-Language': 'sv' } },
	],
})
```

Proxies are handled by [undici](https://undici.nodejs.org/), which is loaded only
when a slot uses a proxy. If it isn't already installed, run `npm install undici`.

`robots.txt` itself is always fetched directly, not through a slot.

## Events

`.on(event, handler)` listens for run events, and `.off(event, handler)` removes a
handler again. Both return the instance, so they can go anywhere in the chain.

| Event   | Payload                                                      | When                                 |
| ------- | ------------------------------------------------------------ | ------------------------------------ |
| `start` | `{ osmotic }`                                                | Before the first request.            |
| `page`  | `{ url, requestedUrl, status, ms }`                          | A page was fetched and parsed.       |
| `skip`  | `{ url, reason, status? }`                                   | A URL was not fetched or not parsed. |
| `error` | `{ url, error }`                                             | A request failed.                    |
| `end`   | `{ osmotic, stats: { pages, robotsSkipped, rows }, error? }` | After the run, also when it failed.  |

- `start` handlers are awaited in order, and one that throws aborts the run.
- `end` handlers are all awaited, even if some throw. `stats.rows` maps each export
  file to the number of rows written, and `error` is set when the run failed.
- `page`, `skip` and `error` handlers are not awaited, so a slow handler never holds
  up the crawl. A handler that throws is logged and doesn't affect the run.
- `reason` is `robots`, `maxPages`, `status` (not 2xx) or `contentType` (not HTML).
  Links back to pages already visited are not reported.
- Registering an `error` handler replaces the default console output for failed
  requests.

```js
Osmotic.get('https://example.com')
	.on('skip', ({ url, reason }) => console.log(`skipped ${url} (${reason})`))
	.on('end', ({ stats }) => console.log(stats))
	.recurse()
	.run();
```

## Extending osmotic

### Custom steps: `.use(fn)`

A step is `(ctx, next) => Promise`. Call `next(ctx)` once to continue, never to
stop the branch, or several times to branch.

```js
.use((ctx, next) => (/ai|llm/i.test(ctx.data.title) ? next(ctx) : Promise.resolve()))
```

**Return `next()`'s promise; don't `await` it.** A step that is suspended in
`await next(ctx)` keeps `ctx`, and with it the page's whole DOM, in memory until
everything after it in the chain has finished on that branch. On a long crawl
that can be most of the pages ever loaded, and the process runs out of memory.
`async` steps are fine as long as they end in `return next(ctx)`:

```js
.use(async (ctx, next) => {
  ctx.data.extra = await lookup(ctx.data.id); // awaiting your own work is fine
  return next(ctx); // not: await next(ctx)
})
```

### Fetch middleware: `.useFetch(mw)`

Wraps every HTTP request. `mw(req, next)` receives `{ url, headers, slot }`, plus
[`attach` and `onRelease`](#pages-that-hold-resources-reqattach-and-reqonrelease), and
must return a `Response`, usually by calling `next(req)`. Middleware runs in the
order it was added.

```js
const retry =
	(times = 2) =>
	async (req, next) => {
		for (let attempt = 0; ; attempt++) {
			const res = await next(req);
			if ((res.status !== 429 && res.status < 500) || attempt >= times) return res;
			await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
		}
	};

Osmotic.get('https://example.com').useFetch(retry(2)) /* ... */;
```

A middleware can carry `onStart` and `onEnd` functions. `useFetch()` registers them
as [`start` and `end` handlers](#events), so a middleware can set up and clean up
after itself.

### Pages that hold resources: `req.attach()` and `req.onRelease()`

A middleware that keeps something open for the page it loads, such as a browser page,
passes it to later steps with `req.attach(key, value)` and closes it with
`req.onRelease(fn)`:

```js
const render = async (req, next) => {
	const page = await browser.newPage();
	req.attach('browserPage', page);
	req.attach('slot', req.slot);
	req.onRelease(() => page.close());
	await page.goto(req.url);
	return new Response(await page.content(), { headers: { 'content-type': 'text/html' } });
};
```

- Steps read the values from `ctx.attached`, a frozen object, until the chain leaves the
  page: `get()`, `follow()` and `recurse()` drop it with the rest of the page.
- `fn` runs once nothing needs the page any more: once no step is still working on it,
  or right away if the page is skipped (status, content type) or fails. Every callback
  runs exactly once, and all of them have settled before exporters close and `end`
  handlers run, also when the run fails. A callback that throws or rejects is logged
  and doesn't fail the run.
- Built-in steps let go of a page as soon as they have passed it on. `find()` lets go
  once it has started its branches, `filter()`, `data()` and `export()` once they
  continue, and `get()`, `follow()` and `recurse()` right away, so a page isn't held
  while its links load. A `recurse()` crawl keeps only the pages it is working on open.
- A custom step holds the page until its promise settles. Since that promise includes
  `next()`'s, a custom step between loading a page and leaving it, such as
  `.click(...).follow('a@href')`, keeps that page open until everything after it on the
  branch has finished.
- Pages that custom commands load with `this.fetchPage()` are released when the run
  ends, not when the chain is done with them.
- Both functions are closures, so `next({ ...req, url })` keeps them. A later
  `attach()` with the same key overwrites the earlier value, also when a middleware
  calls `next(req)` more than once. Calling either one after the middleware chain has
  returned throws.
- Pages without `onRelease()` callbacks aren't tracked, so chains that don't use it
  pay nothing for it.

Commands that act on such a page use [`this.loadPage()` and `this.inSlot()`](#acting-on-a-loaded-page-loadpage-and-inslot).

### Reusable commands: `Osmotic.command(name, factory)`

Registers a chainable method on every `Osmotic` instance. `factory(...args)` returns
a step, and is called with `this` bound to the `Osmotic` instance. Inside a custom
command you can use `this.fetchPage(url)` and `this.links(ctx, spec)`, the same
helpers the built-in commands use, and [`this.loadPage()` and `this.inSlot()`](#acting-on-a-loaded-page-loadpage-and-inslot).
A name that an `Osmotic` method or property already has, such as `find` or `opts`,
throws.

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Osmotic.command('pause', (ms) => (ctx, next) => sleep(ms).then(() => next(ctx)));

Osmotic.get('https://example.com').pause(500).find('a') /* ... */;
```

In TypeScript, declare the new method so the compiler knows about it:

```ts
declare module 'osmotic' {
	interface Osmotic {
		pause(ms: number): this;
	}
}
```

The ESM and CommonJS entry points share a single `Osmotic` class, so a command
registered through one is available through the other.

### Acting on a loaded page: `loadPage()` and `inSlot()`

`this.loadPage(html, url)` parses HTML the way fetched pages are parsed: with the
[selector extras](#selector-extras), the `pseudos` option and `<base href>`. It fires no
`page` event, doesn't count toward `maxPages` or `stats.pages`, and also works outside
`run()`. The page it returns has no `attached` key, so spreading it over the context
keeps the current page's attached values, and the page stays open.

`this.inSlot(fn, { slot, url, priority })` runs `fn(slot)` inside a request slot, as
politely as a page load: it waits for a free slot, or for `slot` (matched by `id`), then
waits out the slot's `delay` (or the `delay` option) and, with `url`, that site's
`Crawl-delay`, shared with page loads. It returns what `fn` returns, frees the slot when
`fn` settles, and throws outside `run()`. By default it goes ahead of waiting page
loads, so work on pages that are already open finishes first; a lower `priority` lets
them go first. It doesn't count toward `maxPages` and doesn't check `robots.txt`. Don't
call `fetchPage()` or `inSlot()` inside `fn`: with every slot taken, they wait for the
slot `fn` holds, and the run never ends.

Together with [`req.attach()`](#pages-that-hold-resources-reqattach-and-reqonrelease),
a command can act on the browser page a middleware loaded, in the slot and through the
proxy that loaded it, and continue on the new HTML:

```js
Osmotic.command('click', function (selector) {
	return async (ctx, next) => {
		const { browserPage, slot } = ctx.attached;
		await this.inSlot(() => browserPage.click(selector), { slot, url: ctx.url });
		return next({ ...ctx, ...this.loadPage(await browserPage.content(), browserPage.url()) });
	};
});
```

### Export types: `Osmotic.exporter(type, factory)`

Registers an export type for `.export(type, file, options)`. `factory(file, options)`
returns an exporter, an object with two methods:

- `write(data)` writes one row. Branches reach the step concurrently, so rows arrive in
  no particular order. If it returns a promise, the branch waits for it.
- `end()` flushes and closes. It is called once when the run ends, also when the run
  failed, and may return a promise. If it throws, the run fails.

osmotic calls the factory on the first row of each run, so every run gets a fresh
exporter, and counts the rows for `stats.rows` and the summary.

```js
const fs = require('node:fs');

Osmotic.exporter('jsonl', (file) => {
	const stream = fs.createWriteStream(file);
	return {
		write: (data) => stream.write(JSON.stringify(data) + '\n'),
		end: () => new Promise((resolve) => stream.end(resolve)),
	};
});

Osmotic.get('https://example.com').set({ title: 'h1' }).export('jsonl', 'titles.jsonl').run();
```

Registering a type that already exists throws. In TypeScript, declare the type's
options so `.export()` checks them:

```ts
declare module 'osmotic' {
	interface ExportTypes {
		jsonl: { pretty?: boolean };
	}
}
```

## Plugins

Plugins are npm packages that add commands, export types and fetch middleware. Load them once,
before building any chains:

```js
const { Osmotic } = require('osmotic');

Osmotic.plugins([require('osmotic-plugin-playwright'), require('osmotic-plugin-csv')]);

Osmotic.get('https://example.com') /* ... */;
```

`Osmotic.plugins(list)` returns `Osmotic`, so it can also start a chain directly.

- **Commands** from a plugin are available on every instance, like ones registered
  with `Osmotic.command()`.
- **Export types** from a plugin can be used with `.export()`, like ones registered
  with `Osmotic.exporter()`.
- **Fetch middleware** from a plugin is added to every chain created after the plugin
  is loaded. It runs after the chain's own `useFetch()` middleware, closest to the
  network.
- **Loading is all or nothing.** If any entry is invalid, has the same name as a
  loaded plugin, or adds a command or export type that already exists, `plugins()` throws and loads
  nothing from the list.
- Loading the same entry twice does nothing, so libraries can load the plugins they
  depend on without coordinating.

### Writing a plugin

A plugin is an object with a `name` and at least one of `commands`, `exporters` and
`fetch`:

| Field       | Type                                      | Description                                                        |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `name`      | `string`                                  | Unique name, normally the package name.                            |
| `commands`  | `{ [name]: (...args) => step }`           | Chainable commands, each a factory as in `Osmotic.command()`.      |
| `exporters` | `{ [type]: (file, options) => exporter }` | Export types, each a factory as in `Osmotic.exporter()`.           |
| `fetch`     | `FetchMiddleware[]`                       | Middleware for every request. `onStart` and `onEnd` hooks run too. |

```js
// osmotic-plugin-pause/index.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
	name: 'osmotic-plugin-pause',
	commands: {
		pause: (ms) => (ctx, next) => sleep(ms).then(() => next(ctx)),
	},
};
```

A plugin that takes options exports a function instead. `plugins()` calls a
function entry without arguments, so give every option a default:

```js
module.exports = ({ ms = 500 } = {}) => ({
	name: 'osmotic-plugin-pause',
	commands: {
		pause:
			(wait = ms) =>
			(ctx, next) =>
				sleep(wait).then(() => next(ctx)),
	},
});

// Both work:
Osmotic.plugins([require('osmotic-plugin-pause')]);
Osmotic.plugins([require('osmotic-plugin-pause')({ ms: 1000 })]);
```

A plugin never needs to load osmotic itself: commands get the instance as `this`, with
helpers like `this.fetchPage(url)`, `this.links(ctx, spec)`, `this.loadPage(html, url)`,
`this.inSlot(fn)` and `this.opts`. ES
modules can `export default` the plugin or the function; `plugins()` unwraps
`default`.

Conventions for publishing:

- Name the package `osmotic-plugin-<name>` (or `@scope/osmotic-plugin-<name>`) and
  add the keyword `osmotic-plugin`.
- List osmotic as a peer dependency, e.g. `"peerDependencies": { "osmotic": "^3.0.0" }`,
  rather than a regular dependency.
- In TypeScript, type the plugin as `OsmoticPlugin` and declare its commands so
  callers get them on `Osmotic` (and any export types' options in `ExportTypes`):

```ts
import type { OsmoticPlugin } from 'osmotic';

declare module 'osmotic' {
	interface Osmotic {
		pause(ms?: number): this;
	}
}

const plugin: OsmoticPlugin = {
	name: 'osmotic-plugin-pause',
	commands: {
		pause:
			(ms: number = 500) =>
			(ctx, next) =>
				sleep(ms).then(() => next(ctx)),
	},
};

export default plugin;
```

A middleware's `onStart` and `onEnd` hooks run once per run of every chain that uses
it, so a plugin that holds a resource, such as a browser, should share it between
runs or count how many are active.

## TypeScript

Type declarations are included for both entry points. Useful exported types
include `Step`, `Context`, `Spec`, `OsmoticOptions`, `SlotConfig`, `FetchMiddleware`,
`FetchRequest`, `RecurseOptions`, `InSlotOptions`, `FilterTest`, `OsmoticEvents`, `RunStats`,
`SkipReason`, `OsmoticPlugin`, `PluginInput`, `Exporter`, `ExporterFactory`,
`ExportTypes` and `ExportOptions`. The public API carries TSDoc comments, so editors show
documentation on hover.

## Development

```sh
npm install            # install dependencies (does not build)
npm run build          # clean dist/ and compile src/ with tsc (also runs before npm publish)
npm run clean          # remove dist/
npm test               # build, type-check test/ and test-d/, and run the tests
npm run format         # format everything with Prettier
npm run format:check   # check formatting without writing
```

Code uses single quotes and tab indentation, set in `.prettierrc.json` and
`.editorconfig`.

| Folder                            | Contents                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/index.cts` / `src/index.mts` | CommonJS and ESM entry points                                                                                               |
| `src/core/`                       | The `Osmotic` class and what it runs on: events, exporters, plugin loading, fetch middleware, `robots.txt` cache, slot pool |
| `src/commands/`                   | The built-in chain commands, one file per command (`get.ts`, `find.ts`, `recurse.ts` and so on)                             |
| `src/types/`                      | Public types, one file per concern                                                                                          |
| `src/utils/`                      | Small helpers: extraction specs, link collection, selector extras, URL resolution                                           |

Examples are in [`examples/`](examples/). Tests are in [`test/`](test/), served from local
test sites built with `test/helpers/create-site.ts`, and type tests in [`test-d/`](test-d/).

## License

ISC
