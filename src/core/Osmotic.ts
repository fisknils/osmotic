import * as cheerio from 'cheerio';
import { dataStep } from '../commands/data.js';
import { exportStep } from '../commands/export.js';
import { filterStep } from '../commands/filter.js';
import { findStep } from '../commands/find.js';
import { followStep } from '../commands/follow.js';
import { getStep } from '../commands/get.js';
import { recurseStep } from '../commands/recurse.js';
import { setStep } from '../commands/set.js';
import { tapStep } from '../commands/tap.js';
import type { FilterTest, InSlotOptions, RecurseOptions } from '../types/commands.js';
import type { Context, Data, Next, Page, Step } from '../types/context.js';
import type { Handler, OsmoticEvent, RunStats, SkipReason } from '../types/events.js';
import type { ExporterFactory, ExportOptions } from '../types/exporters.js';
import type { FetchMiddleware, FetchRequest } from '../types/fetch.js';
import type { OsmoticOptions, Slot } from '../types/options.js';
import type { PluginInput } from '../types/plugins.js';
import type { Spec } from '../types/specs.js';
import { collectLinks } from '../utils/collect-links.js';
import { pageBase } from '../utils/page-base.js';
import { builtinPseudos } from '../utils/pseudos.js';
import { sleep } from '../utils/sleep.js';
import type { CommandHost } from './command-host.js';
import { Emitter } from './Emitter.js';
import { addExporter } from './exporters.js';
import type { ExportTarget } from './ExportTarget.js';
import { fetchThrough } from './http.js';
import { pageOf } from './page.js';
import { loadPlugins, pluginMiddleware } from './plugins.js';
import { ReleaseTracker } from './ReleaseTracker.js';
import { RobotsCache } from './RobotsCache.js';
import { SlotPool } from './SlotPool.js';

// State that lives for a single run()
interface RunState {
	seen: Set<string>;
	robots: RobotsCache;
	pool: SlotPool;
	releases: ReleaseTracker;
	attempts: number;
	pages: number;
	robotsSkipped: number;
}

/**
 * A chainable scraper. Each command adds a step to the chain; {@link Osmotic.run}
 * starts at the first step and runs every branch to the end.
 *
 * @example
 * ```ts
 * await Osmotic.get('https://news.ycombinator.com')
 * 	.find('tr.athing')
 * 	.set({ title: '.titleline > a' })
 * 	.export('csv', 'hn.csv')
 * 	.run();
 * ```
 */
export class Osmotic {
	/** The current options. Change them with {@link Osmotic.config}. */
	readonly opts: OsmoticOptions = {
		concurrency: 4,
		maxPages: 100,
		delay: 0,
		userAgent: 'osmotic/0.1',
		headers: {},
		pseudos: {},
		slots: null,
		respectRobots: true,
		respectCrawlDelay: true,
		robotsUserAgent: null,
		resolveUrls: true,
	};

	readonly #steps: Step[] = [];
	readonly #exports: ExportTarget[] = [];
	readonly #fetchMiddleware: FetchMiddleware[] = [];
	readonly #events = new Emitter();
	#state: RunState | null = null;
	// Middleware from plugins loaded before this chain was created; runs after fetchMiddleware
	readonly #pluginFetch: FetchMiddleware[] = [...pluginMiddleware];
	// What the built-in commands in src/commands/ reach of this instance. An ES private field
	// isn't a property, so it can't hide a command a plugin registers as `host` (see #16)
	readonly #host: CommandHost = {
		opts: this.opts,
		priority: () => this.#steps.length,
		visit: (url, from, next, priority) => this.visit(url, from, next, priority),
		links: (ctx, spec) => this.links(ctx, spec),
		addExport: (target) => void this.#exports.push(target),
	};

	/**
	 * Create an empty chain. The fetch middleware of plugins loaded so far is added to it;
	 * the middleware of plugins loaded later isn't, so load plugins first. Their commands
	 * and export types work on every instance, whenever they're loaded.
	 *
	 * @example
	 * ```ts
	 * const chain = new Osmotic().config({ concurrency: 2 }).get('https://example.com');
	 * ```
	 */
	constructor() {
		for (const mw of this.#pluginFetch) this.addHooks(mw);
	}

	/**
	 * Start a new chain by loading `url`. Shorthand for `new Osmotic().get(url)`.
	 *
	 * @param url - The absolute URL of the first page.
	 * @throws When the chain runs, if `url` isn't an absolute URL (`TypeError: Invalid
	 * URL`); the run then fails.
	 *
	 * @example
	 * ```ts
	 * await Osmotic.get('https://example.com').set({ title: 'h1' }).data((row) => console.log(row)).run();
	 * ```
	 */
	static get(url: string): Osmotic {
		return new Osmotic().get(url);
	}

	/**
	 * Merge `opts` into the current options. It can be called anywhere in the chain, and the
	 * options apply to the whole run, whatever the position of the call.
	 *
	 * @param opts - The options to change; the others keep their values.
	 *
	 * @example
	 * ```ts
	 * .config({ concurrency: 2, delay: 500, maxPages: 1000 })
	 * ```
	 */
	config(opts: Partial<OsmoticOptions>): this {
		Object.assign(this.opts, opts);
		return this;
	}

	/**
	 * Append a step to the chain. Same as {@link Osmotic.use}. Commands registered with
	 * {@link Osmotic.command} are added with it: their factory returns the step instead of
	 * calling `add()`.
	 *
	 * @param step - The step to run after the steps added so far.
	 *
	 * @example
	 * ```ts
	 * chain.add((ctx, next) => next({ ...ctx, data: { ...ctx.data, source: 'archive' } }));
	 * ```
	 */
	add(step: Step): this {
		this.#steps.push(step);
		return this;
	}

	// --- Extension points -----------------------------------------------------

	/**
	 * Insert a custom chain step. Call `next(ctx)` zero times to stop the branch,
	 * once to continue, or several times to branch.
	 *
	 * Return `next()`'s promise instead of awaiting it where you can: an `async` step that
	 * awaits keeps the page's DOM alive until every branch below it has finished.
	 *
	 * @param fn - The step. It gets the context and `next`, and returns a promise that
	 * settles when its branches are done.
	 *
	 * @example
	 * ```ts
	 * .use((ctx, next) => (/ai|llm/i.test(String(ctx.data.title)) ? next(ctx) : Promise.resolve()))
	 * ```
	 */
	use(fn: Step): this {
		return this.add(fn);
	}

	/**
	 * Wrap every HTTP request. `next(req)` returns the `Response`, and middleware runs
	 * in the order added. A middleware's own `onStart` and `onEnd` hooks are
	 * registered as `start` and `end` handlers.
	 *
	 * The chain's own middleware runs before the middleware of plugins, which is closest to
	 * the network.
	 *
	 * @param mw - The middleware: `(req, next) => Promise<Response>`.
	 *
	 * @example
	 * ```ts
	 * .useFetch((req, next) => next({ ...req, headers: { ...req.headers, Cookie: 'consent=1' } }))
	 * ```
	 */
	useFetch(mw: FetchMiddleware): this {
		this.#fetchMiddleware.push(mw);
		this.addHooks(mw);
		return this;
	}

	/**
	 * Listen for a run event:
	 *
	 * - `start`: before the first request (awaited; throwing aborts the run)
	 * - `page`: a page was fetched and parsed
	 * - `skip`: a URL was not fetched or not parsed, with the reason
	 * - `error`: a request failed (replaces the default console output)
	 * - `end`: after the run, also when it failed (awaited; every handler runs)
	 *
	 * `page`, `skip` and `error` handlers are not awaited, so a slow handler never
	 * holds up the crawl. A `page`, `skip` or `error` handler that throws is logged and
	 * doesn't affect the run.
	 *
	 * @typeParam E - The event name, which sets the payload type `handler` gets.
	 * @param event - The event to listen for.
	 * @param handler - Called with the event's payload; may be async.
	 *
	 * @example
	 * ```ts
	 * .on('skip', ({ url, reason }) => console.log(`skipped ${url}: ${reason}`))
	 * ```
	 */
	on<E extends OsmoticEvent>(event: E, handler: Handler<E>): this {
		this.#events.on(event, handler);
		return this;
	}

	/**
	 * Remove a handler added with {@link Osmotic.on}. Does nothing if it isn't registered.
	 *
	 * @typeParam E - The event name.
	 * @param event - The event the handler was added for.
	 * @param handler - The same function that was passed to {@link Osmotic.on}.
	 *
	 * @example
	 * ```ts
	 * const log: Handler<'page'> = ({ url }) => console.log(url);
	 * chain.on('page', log);
	 * chain.off('page', log);
	 * ```
	 */
	off<E extends OsmoticEvent>(event: E, handler: Handler<E>): this {
		this.#events.off(event, handler);
		return this;
	}

	/**
	 * Register a reusable chainable command on all Osmotic instances.
	 *
	 * @typeParam A - The command's arguments, as the factory takes them.
	 * @param name - The method name.
	 * @param factory - Returns the step for the given arguments. Called with `this`
	 * bound to the instance.
	 * @throws If a method or public property called `name` already exists, such as `find`
	 * or `opts`.
	 *
	 * @example
	 * ```ts
	 * Osmotic.command('pause', (ms: number) => (ctx, next) => sleep(ms).then(() => next(ctx)));
	 *
	 * // TypeScript callers declare the new method through interface merging:
	 * declare module 'osmotic' {
	 * 	interface Osmotic {
	 * 		pause(ms: number): this;
	 * 	}
	 * }
	 * ```
	 */
	static command<A extends unknown[]>(name: string, factory: (this: Osmotic, ...args: A) => Step): void {
		if (Osmotic.isTaken(name)) throw new Error(`Osmotic command "${name}" already exists`);
		(Osmotic.prototype as unknown as Record<string, unknown>)[name] = function (this: Osmotic, ...args: A) {
			return this.add(factory.apply(this, args));
		};
	}

	/**
	 * Register an export type on all Osmotic instances, for {@link Osmotic.export}.
	 *
	 * @typeParam O - The options the type takes. Declare them in `ExportTypes` too, so
	 * `.export()` checks them.
	 * @param type - The type name, such as `'csv'`.
	 * @param factory - Creates the exporter for a step's file and options. Called on the
	 * first row of each run.
	 * @throws If an exporter for `type` already exists.
	 *
	 * @example
	 * ```ts
	 * import fs from 'node:fs';
	 *
	 * Osmotic.exporter('json-lines', (file) => {
	 * 	const out = fs.createWriteStream(file);
	 * 	return {
	 * 		write: (row) => out.write(JSON.stringify(row) + '\n'),
	 * 		end: () => new Promise((resolve) => out.end(resolve)),
	 * 	};
	 * });
	 * ```
	 */
	static exporter<O = any>(type: string, factory: ExporterFactory<O>): void {
		addExporter(type, factory);
	}

	/**
	 * Load plugins: their commands and exporters become available on every instance, and their fetch
	 * middleware is added to every chain created afterwards, so load plugins first.
	 *
	 * Each entry is a plugin object, or a function returning one, which is called
	 * without arguments. Loading the same entry again does nothing.
	 *
	 * @param list - The plugins to load, in order.
	 * @returns `Osmotic`, so more static calls can follow.
	 * @throws If an entry is not a valid plugin, another plugin with the same name is
	 * loaded, or a command name or export type is taken. Nothing in the list is loaded then.
	 *
	 * @example
	 * ```ts
	 * Osmotic.plugins([require('osmotic-plugin-playwright')]);
	 * ```
	 */
	static plugins(list: PluginInput[]): typeof Osmotic {
		loadPlugins(list, {
			hasCommand: (name) => Osmotic.isTaken(name),
			addCommand: (name, factory) => Osmotic.command(name, factory),
		});
		return Osmotic;
	}

	// Whether a command can't be called `name`: a method has it, or an instance's own
	// property does, which would hide the command on every instance (such as opts)
	private static isTaken(name: string): boolean {
		return name in Osmotic.prototype || Object.hasOwn(new Osmotic(), name);
	}

	// --- Commands -------------------------------------------------------------
	// Each command's step is built in its own file in src/commands/.

	/**
	 * Load a page and continue the chain on it. The data collected so far carries over;
	 * the previous page doesn't. Each URL is fetched at most once per run.
	 *
	 * @param url - The URL to load. A relative URL resolves against the current page's
	 * `<base href>` or URL, so it needs a page loaded before this step.
	 * @throws When the step runs with a relative URL and no page loaded, or a malformed URL
	 * (`TypeError: Invalid URL`); the run then fails.
	 *
	 * @example
	 * ```ts
	 * Osmotic.get('https://example.com').set({ title: 'h1' }).get('/about').set({ about: 'main' })
	 * ```
	 */
	get(url: string): this {
		return this.add(getStep(this.#host, url));
	}

	/**
	 * Continue the chain once for each element matching `selector` inside the current
	 * node, so every later step runs once per match. The branches run concurrently.
	 *
	 * @param selector - A CSS selector, with the selector extras: XPath-style indexes
	 * (`span[2]`), `:text-is("…")`, `:text-match("…")` and the `pseudos` option.
	 * @throws When the step runs before a page is loaded, or with an invalid selector; the
	 * run then fails.
	 *
	 * @example
	 * ```ts
	 * .find('.product').set({ name: 'h2', price: '.price' })
	 * ```
	 */
	find(selector: string): this {
		return this.add(findStep(selector));
	}

	/**
	 * Continue only if `test` passes; otherwise the branch ends here.
	 *
	 * @param test - A selector, which passes when the current node contains a match, or
	 * a function `($, node, data)`, which passes when it returns or resolves to a truthy
	 * value.
	 * @throws When the step runs before a page is loaded, with an invalid selector, or with
	 * what a test function throws or rejects with; the run then fails.
	 *
	 * @example
	 * ```ts
	 * .filter('.badge-sale')
	 * .filter(($) => $('script[type="application/ld+json"]').text().includes('"Product"'))
	 * ```
	 */
	filter(test: FilterTest): this {
		return this.add(filterStep(test));
	}

	/**
	 * Extract fields relative to the current node and merge them into `data`. A field set
	 * by an earlier `.set()` is overwritten.
	 *
	 * @param fields - The fields to extract, each a {@link Spec}: text, an attribute, an
	 * array of matches, a list of objects or a nested object. With the `resolveUrls`
	 * option on, URL attributes come back absolute.
	 * @throws When the step runs before a page is loaded, or a spec is malformed or has an
	 * invalid selector; the run then fails.
	 *
	 * @example
	 * ```ts
	 * .set({
	 * 	title: 'h1',
	 * 	image: 'meta[property="og:image"]@content',
	 * 	tags: ['.tag'],
	 * 	offers: ['.offer', { seller: '.seller', price: '.price' }],
	 * })
	 * ```
	 */
	set(fields: Record<string, Spec>): this {
		return this.add(setStep(this.#host, fields));
	}

	/**
	 * Load every URL found by `spec` and continue the chain on each page. Data collected
	 * so far carries over. Only `http(s)` links are followed, `#fragments` are dropped,
	 * and each URL is fetched at most once per run.
	 *
	 * @param spec - Where to find the links: `"selector@attr"`, relative to the current
	 * node. Without `@attr` it reads `href`. Defaults to `'a@href'`.
	 * @throws When the step runs before a page is loaded, or with an invalid selector; the
	 * run then fails.
	 *
	 * @example
	 * ```ts
	 * .find('.product').set({ name: 'h2' }).follow('a@href').set({ description: '.description' })
	 * ```
	 */
	follow(spec = 'a@href'): this {
		return this.add(followStep(this.#host, spec));
	}

	/**
	 * Run the rest of the chain on this page, then follow links found by `spec` and
	 * repeat this step on each new page. Each URL is visited once per run, so together
	 * with `maxPages` this crawls a site.
	 *
	 * @param spec - Where to find the links, as for {@link Osmotic.follow}. Defaults to
	 * `'a@href'`.
	 * @param options - `sameDomain` (only links to the current page's hostname, default
	 * `true`) and `exclude` (skip links whose pathname matches one of these regexes,
	 * default `[]`).
	 * @throws When the step runs before a page is loaded, or with an invalid selector; the
	 * run then fails.
	 *
	 * @example
	 * ```ts
	 * Osmotic.get('https://example.com/')
	 * 	.recurse('a:not([rel~="nofollow"])@href', { exclude: [/^\/checkout\//] })
	 * 	.set({ title: 'h1' })
	 * ```
	 */
	recurse(spec = 'a@href', options: RecurseOptions = {}): this {
		return this.add(recurseStep(this.#host, spec, options));
	}

	/**
	 * Log `[label] url` for every branch reaching this step, then continue unchanged.
	 * Before a page is loaded, it logs `(no page)` as the URL.
	 *
	 * @param label - The text in brackets, to tell several taps apart. Defaults to
	 * `'tap'`.
	 *
	 * @example
	 * ```ts
	 * .recurse().tap('crawl').set({ title: 'h1' })
	 * ```
	 */
	tap(label = 'tap'): this {
		return this.add(tapStep(label));
	}

	/**
	 * Call `cb` with the data collected so far, then continue. The branch waits for `cb`,
	 * and if it throws or rejects, the run fails.
	 *
	 * @param cb - Called as `cb(data, ctx)` for every branch reaching this step; may be
	 * async.
	 *
	 * @example
	 * ```ts
	 * .set({ title: 'h1' }).data((row) => rows.push(row))
	 * ```
	 */
	data(cb: (data: Data, ctx: Context) => unknown): this {
		return this.add(dataStep(cb));
	}

	/**
	 * Write each data object reaching this step to `file`, in the format of export
	 * `type`. Export types come from plugins, such as `osmotic-plugin-csv`, so load them
	 * before building the chain. The file is created on the first row of each run.
	 *
	 * @typeParam T - The export type, which sets the type of `options` for types that
	 * plugins declare in `ExportTypes`.
	 * @param type - The export type, such as `'csv'`.
	 * @param file - The file to write. What happens to an existing file depends on the
	 * exporter.
	 * @param options - Passed to the exporter; what it accepts depends on the type.
	 * @throws If no exporter for `type` is loaded, when the chain is built. An error from the
	 * exporter fails the run.
	 *
	 * @example
	 * ```ts
	 * .export('csv', 'products.csv', { delimiter: ',' })
	 * ```
	 */
	export<T extends string>(type: T, file: string, options?: ExportOptions<T>): this {
		return this.add(exportStep(this.#host, type, file, options));
	}

	// --- Helpers for custom commands -------------------------------------------

	/**
	 * Unique absolute http(s) URLs found by `spec`, relative to the current node, with
	 * `#fragments` dropped. Built-in `follow()` and `recurse()` use it too.
	 *
	 * @param ctx - The context of the step calling it.
	 * @param spec - Where to find the links: `"selector@attr"`. Without `@attr` it reads
	 * `href`.
	 * @returns The URLs, in document order.
	 * @throws If no page is loaded yet.
	 *
	 * @example
	 * ```ts
	 * Osmotic.command('countLinks', function () {
	 * 	return (ctx, next) => next({ ...ctx, data: { ...ctx.data, links: this.links(ctx, 'a').length } });
	 * });
	 * ```
	 */
	links(ctx: Context, spec: string): string[] {
		const { $, node, base } = pageOf(ctx);
		return collectLinks($, node, spec, base);
	}

	/**
	 * Fetch and parse `url` the way built-in steps do: once per run, following
	 * `robots.txt`, `maxPages`, the slots and their delays, and firing `page`, `skip` and
	 * `error` events.
	 *
	 * The page carries the values fetch middleware attached in `attached`, `{}` when there are
	 * none. Its `onRelease` callbacks run when the run ends, not when the chain is done with
	 * it, so a page that holds a resource, such as a browser page, stays open until then.
	 *
	 * @param url - The absolute URL to fetch.
	 * @param priority - Requests with a higher priority get the next free slot first.
	 * Built-in steps use their position in the chain. Defaults to `0`.
	 * @returns The page, or `null` if the URL was already seen, is disallowed, exceeds
	 * `maxPages`, fails, or isn't HTML.
	 * @throws If called outside {@link Osmotic.run}.
	 *
	 * @example
	 * ```ts
	 * Osmotic.command('load', function (url: string) {
	 * 	return (ctx, next) => this.fetchPage(url).then((page) => (page ? next({ ...ctx, ...page }) : undefined));
	 * });
	 * ```
	 */
	async fetchPage(url: string, priority = 0): Promise<Page | null> {
		return this.load(this.runState(), url, priority, false);
	}

	/**
	 * Parse `html` as a page at `url`, the way fetched pages are parsed: with the built-in
	 * pseudo-classes, the `pseudos` option and the base from `<base href>`. Use it to continue
	 * on HTML that changed after the page loaded, such as a browser page's after a click.
	 *
	 * Unlike {@link Osmotic.fetchPage}, it fires no `page` event, doesn't count toward
	 * `maxPages` or `stats.pages`, and also works outside {@link Osmotic.run}. The page has no
	 * `attached` key, so spreading it over a context keeps the current page's attached values
	 * and its release tracking.
	 *
	 * @param html - The HTML to parse.
	 * @param url - The page's URL, for relative links when there's no `<base href>`.
	 * @returns The page, positioned at the document root.
	 *
	 * @example
	 * ```ts
	 * Osmotic.command('click', function (selector: string) {
	 * 	return async (ctx, next) => {
	 * 		const page = ctx.attached?.browserPage as BrowserPage;
	 * 		await page.click(selector);
	 * 		return next({ ...ctx, ...this.loadPage(await page.content(), page.url()) });
	 * 	};
	 * });
	 * ```
	 */
	loadPage(html: string, url: string): Page {
		const $ = cheerio.load(html, { pseudos: { ...builtinPseudos, ...this.opts.pseudos } });
		return { $, node: $.root(), url, base: pageBase($, url) };
	}

	/**
	 * Run `fn` inside a request slot, as politely as a page load. It waits for a free slot, or
	 * for `options.slot`, then waits out the slot's `delay` (or the `delay` option) and, with
	 * `options.url`, that site's `Crawl-delay`, shared with page loads. The slot is freed when
	 * `fn` settles, also when it throws.
	 *
	 * Use it for requests a step makes outside `fetchPage()`, such as clicking in a browser
	 * page, so they keep to `concurrency`, `slots` and the delays. It doesn't count toward
	 * `maxPages` and doesn't check `robots.txt`. By default it goes ahead of waiting page
	 * loads, so work on pages that are already open finishes first.
	 *
	 * Don't call `fetchPage()` or `inSlot()` inside `fn`: with every slot taken, they wait for a
	 * slot that `fn` itself holds, and the run never ends.
	 *
	 * @typeParam T - What `fn` returns or resolves to.
	 * @param fn - The work to do, called with the slot it runs in; may be async.
	 * @param options - `slot` to wait for, the `url` whose `Crawl-delay` to wait out, and the
	 * `priority`. Defaults to `{}`.
	 * @returns What `fn` returns or resolves to.
	 * @throws If called outside {@link Osmotic.run}, if `options.slot` isn't one of the run's
	 * slots, or what `fn` throws or rejects with.
	 *
	 * @example
	 * ```ts
	 * Osmotic.command('click', function (selector: string) {
	 * 	return async (ctx, next) => {
	 * 		const page = ctx.attached?.browserPage as BrowserPage;
	 * 		const slot = ctx.attached?.slot as Slot;
	 * 		await this.inSlot(() => page.click(selector), { slot, url: ctx.url });
	 * 		return next({ ...ctx, ...this.loadPage(await page.content(), page.url()) });
	 * 	};
	 * });
	 * ```
	 */
	async inSlot<T>(fn: (slot: Slot) => T | PromiseLike<T>, options: InSlotOptions = {}): Promise<T> {
		const { slot, url, priority = Infinity } = options;
		const run = this.runState('inSlot() can only be called while run() is in progress');
		const taken = await run.pool.acquire(priority, slot?.id);
		try {
			await this.waitTurn(run, taken, url);
			return await fn(taken);
		} finally {
			run.pool.release(taken);
		}
	}

	// --- Running --------------------------------------------------------------

	/**
	 * Run the chain. Resolves once every branch has finished. A chain can be run again;
	 * each run starts with no pages seen and fresh exports.
	 *
	 * Exporters are closed and `end` handlers run even if the run fails. After every run it
	 * logs a line per export to the console, with the rows written. After a successful run
	 * it also logs the number of pages fetched and, if any, of URLs skipped because of
	 * `robots.txt`.
	 *
	 * @throws What a step, `start` handler or exporter threw.
	 *
	 * @example
	 * ```ts
	 * await Osmotic.get('https://example.com').set({ title: 'h1' }).export('csv', 'out.csv').run();
	 * ```
	 */
	async run(): Promise<void> {
		const slotConfigs = this.opts.slots ?? Array.from({ length: this.opts.concurrency }, () => ({}));
		const run: RunState = {
			seen: new Set(),
			robots: new RobotsCache(this.opts.robotsUserAgent ?? this.opts.userAgent),
			pool: new SlotPool(slotConfigs.map((cfg, id) => ({ id, ...cfg }))),
			releases: new ReleaseTracker(),
			attempts: 0,
			pages: 0,
			robotsSkipped: 0,
		};
		this.#state = run;
		for (const target of this.#exports) target.reset();
		let failed = false;
		let failure: unknown;
		// A step that throws synchronously rejects only its own branch, as an async step would.
		// On a page whose release is tracked, the step holds the page while it works on it.
		const runFrom =
			(i: number): Next =>
			(ctx) => {
				if (i >= this.#steps.length) return Promise.resolve();
				const held = run.releases.tracking ? run.releases.heldBy(ctx) : undefined;
				if (held) return run.releases.runStep(held, this.#steps[i], ctx, runFrom(i + 1));
				try {
					return this.#steps[i](ctx, runFrom(i + 1));
				} catch (err) {
					return Promise.reject(err);
				}
			};
		try {
			await this.#events.emitSerial('start', { osmotic: this });
			await runFrom(0)({ data: {} });
		} catch (err) {
			failed = true;
			failure = err;
		}
		await run.releases.close();
		// An exporter that fails to close fails the run, unless it had already failed
		for (const err of await this.closeExports()) {
			if (failed) console.error(`osmotic: closing an export failed: ${err instanceof Error ? err.stack : err}`);
			else [failed, failure] = [true, err];
		}
		const stats: RunStats = {
			pages: run.pages,
			robotsSkipped: run.robotsSkipped,
			rows: Object.fromEntries(this.#exports.map((t) => [t.file, t.rowCount])),
		};
		await this.#events.emitSettled('end', { osmotic: this, stats, ...(failed ? { error: failure } : {}) });
		this.#state = null;
		if (failed) throw failure;
		console.log(`Done. Fetched ${run.pages} page(s).`);
		if (run.robotsSkipped) console.log(`Skipped ${run.robotsSkipped} URL(s) disallowed by robots.txt.`);
	}

	// --- Internals ------------------------------------------------------------

	// Load url and continue the chain on it, with from's data carried over.
	// Later steps get priority so branches finish (and free memory) before the
	// crawl widens; first come, first served would queue up the whole site.
	// Unlike pages from the public fetchPage(), these are released once no step holds them.
	private async visit(url: string, from: Context, next: Next, priority: number): Promise<void> {
		const run = this.runState();
		const page = await this.load(run, url, priority, true);
		if (page) return run.releases.deliver({ ...from, ...page }, next);
	}

	// fetchPage(), with the page's release callbacks either tracked or run when the run ends
	private async load(run: RunState, url: string, priority: number, track: boolean): Promise<Page | null> {
		if (run.seen.has(url)) return null; // Duplicates are expected; not reported as skips
		run.seen.add(url);
		if (this.opts.respectRobots && !(await run.robots.allows(url))) {
			run.robotsSkipped++;
			return this.skip(url, 'robots');
		}
		if (run.attempts >= this.opts.maxPages) return this.skip(url, 'maxPages');
		run.attempts++;
		const slot = await run.pool.acquire(priority);
		const attached = new Map<string, unknown>();
		const callbacks: (() => unknown)[] = [];
		let page: Page | null = null;
		try {
			await this.waitTurn(run, slot, url);
			const started = Date.now();
			const res = await this.slotFetch(slot, url, attached, callbacks);
			const html = (res.headers.get('content-type') || '').includes('html');
			if (!res.ok || !html) {
				res.body?.cancel().catch(() => {}); // Release the unread body and its connection
				return this.skip(url, res.ok ? 'contentType' : 'status', res.status);
			}
			const finalUrl = res.url || url; // Constructed Responses (e.g. from middleware) have no url
			page = { ...this.loadPage(await res.text(), finalUrl), attached: Object.freeze(Object.fromEntries(attached)) };
			run.pages++;
			this.#events.emit('page', { url: finalUrl, requestedUrl: url, status: res.status, ms: Date.now() - started });
			return page;
		} catch (error) {
			if (this.#events.has('error')) this.#events.emit('error', { url, error });
			else console.error(`Failed ${url}: ${error instanceof Error ? error.message : error}`);
			return null;
		} finally {
			run.pool.release(slot);
			// Skipped and failed pages are released right away
			if (callbacks.length) {
				if (!page) run.releases.release(callbacks);
				else if (track) run.releases.track(page.attached!, callbacks);
				else run.releases.defer(callbacks);
			}
		}
	}

	// Wait out the site's Crawl-delay, if a url is given, and the slot's delay
	private async waitTurn(run: RunState, slot: Slot, url?: string): Promise<void> {
		if (url && this.opts.respectRobots && this.opts.respectCrawlDelay) {
			await run.robots.waitCrawlDelay(url);
		}
		const delay = slot.delay ?? this.opts.delay;
		if (delay) await sleep(delay);
	}

	private skip(url: string, reason: SkipReason, status?: number): null {
		this.#events.emit('skip', status === undefined ? { url, reason } : { url, reason, status });
		return null;
	}

	private runState(message = 'Pages can only be fetched while run() is in progress'): RunState {
		if (!this.#state) throw new Error(message);
		return this.#state;
	}

	// Fetch through the slot's settings, falling back to the global options. What middleware
	// attaches to the page goes into attached and callbacks, until the middleware returns.
	private async slotFetch(
		slot: Slot,
		url: string,
		attached: Map<string, unknown>,
		callbacks: (() => unknown)[],
	): Promise<Response> {
		let open = true;
		const check = (name: string) => {
			if (!open) throw new Error(`req.${name}() can only be called until the fetch middleware returns`);
		};
		const req: FetchRequest = {
			url,
			slot,
			headers: {
				'User-Agent': slot.userAgent ?? this.opts.userAgent,
				...this.opts.headers,
				...slot.headers,
			},
			attach: (key, value) => {
				check('attach');
				attached.set(key, value);
			},
			onRelease: (fn) => {
				check('onRelease');
				if (typeof fn !== 'function') throw new TypeError('req.onRelease() takes a function');
				callbacks.push(fn);
			},
		};
		try {
			return await fetchThrough([...this.#fetchMiddleware, ...this.#pluginFetch], req);
		} finally {
			open = false;
		}
	}

	// Register a middleware's own onStart/onEnd hooks as start/end handlers
	private addHooks(mw: FetchMiddleware): void {
		if (mw.onStart) this.on('start', () => mw.onStart!());
		if (mw.onEnd) this.on('end', () => mw.onEnd!());
	}

	// Close every export, even if some fail, and return the errors
	private async closeExports(): Promise<unknown[]> {
		const results = await Promise.allSettled(this.#exports.map((t) => t.end()));
		for (const t of this.#exports) console.log(t.summary());
		return results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
	}
}
