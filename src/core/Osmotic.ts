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
import type { FilterTest, RecurseOptions } from '../types/commands.js';
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
import { RobotsCache } from './RobotsCache.js';
import { SlotPool } from './SlotPool.js';

// State that lives for a single run()
interface RunState {
	seen: Set<string>;
	robots: RobotsCache;
	pool: SlotPool;
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

	private readonly steps: Step[] = [];
	private readonly exports: ExportTarget[] = [];
	private readonly fetchMiddleware: FetchMiddleware[] = [];
	private readonly events = new Emitter();
	private state: RunState | null = null;
	// Middleware from plugins loaded before this chain was created; runs after fetchMiddleware
	private readonly pluginFetch: FetchMiddleware[] = [...pluginMiddleware];
	// What the built-in commands in src/commands/ reach of this instance
	private readonly host: CommandHost = {
		opts: this.opts,
		priority: () => this.steps.length,
		visit: (url, from, next, priority) => this.visit(url, from, next, priority),
		links: (ctx, spec) => this.links(ctx, spec),
		addExport: (target) => void this.exports.push(target),
	};

	/**
	 * Create an empty chain. The fetch middleware of plugins loaded so far is added to it;
	 * plugins loaded later don't reach it, so load plugins first.
	 *
	 * @example
	 * ```ts
	 * const chain = new Osmotic().config({ concurrency: 2 }).get('https://example.com');
	 * ```
	 */
	constructor() {
		for (const mw of this.pluginFetch) this.addHooks(mw);
	}

	/**
	 * Start a new chain by loading `url`. Shorthand for `new Osmotic().get(url)`.
	 *
	 * @param url - The absolute URL of the first page.
	 *
	 * @example
	 * ```ts
	 * await Osmotic.get('https://example.com').set({ title: 'h1' }).data(console.log).run();
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
	 * Append a step to the chain. Same as {@link Osmotic.use}; custom commands call it
	 * through `this.add()`.
	 *
	 * @param step - The step to run after the steps added so far.
	 *
	 * @example
	 * ```ts
	 * chain.add((ctx, next) => next({ ...ctx, data: { ...ctx.data, source: 'archive' } }));
	 * ```
	 */
	add(step: Step): this {
		this.steps.push(step);
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
		this.fetchMiddleware.push(mw);
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
		this.events.on(event, handler);
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
		this.events.off(event, handler);
		return this;
	}

	/**
	 * Register a reusable chainable command on all Osmotic instances.
	 *
	 * @typeParam A - The command's arguments, as the factory takes them.
	 * @param name - The method name.
	 * @param factory - Returns the step for the given arguments. Called with `this`
	 * bound to the instance.
	 * @throws If a method called `name` already exists.
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
		if (name in Osmotic.prototype) throw new Error(`Osmotic command "${name}" already exists`);
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
	 * Osmotic.exporter('json-lines', (file) => {
	 * 	const out = fs.createWriteStream(file);
	 * 	return { write: (row) => out.write(JSON.stringify(row) + '\n'), end: () => out.end() };
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
			hasCommand: (name) => name in Osmotic.prototype,
			addCommand: (name, factory) => Osmotic.command(name, factory),
		});
		return Osmotic;
	}

	// --- Commands -------------------------------------------------------------
	// Each command's step is built in its own file in src/commands/.

	/**
	 * Load a page and continue the chain on it. The data collected so far carries over;
	 * the previous page doesn't. Each URL is fetched at most once per run.
	 *
	 * @param url - The URL to load. A relative URL resolves against the current page's
	 * `<base href>` or URL, so it needs a page loaded before this step; otherwise the
	 * run fails with an invalid URL error.
	 *
	 * @example
	 * ```ts
	 * Osmotic.get('https://example.com').set({ title: 'h1' }).get('/about').set({ about: 'main' })
	 * ```
	 */
	get(url: string): this {
		return this.add(getStep(this.host, url));
	}

	/**
	 * Continue the chain once for each element matching `selector` inside the current
	 * node, so every later step runs once per match. The branches run concurrently.
	 *
	 * @param selector - A CSS selector, with the selector extras: XPath-style indexes
	 * (`span[2]`), `:text-is("…")`, `:text-match("…")` and the `pseudos` option.
	 * @throws When the step runs before a page is loaded; the run then fails.
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
	 * @throws When the step runs before a page is loaded; the run then fails.
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
	 * @throws When the step runs before a page is loaded, or a spec is malformed; the run
	 * then fails.
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
		return this.add(setStep(this.host, fields));
	}

	/**
	 * Load every URL found by `spec` and continue the chain on each page. Data collected
	 * so far carries over. Only `http(s)` links are followed, `#fragments` are dropped,
	 * and each URL is fetched at most once per run.
	 *
	 * @param spec - Where to find the links: `"selector@attr"`, relative to the current
	 * node. Without `@attr` it reads `href`. Defaults to `'a@href'`.
	 * @throws When the step runs before a page is loaded; the run then fails.
	 *
	 * @example
	 * ```ts
	 * .find('.product').set({ name: 'h2' }).follow('a@href').set({ description: '.description' })
	 * ```
	 */
	follow(spec = 'a@href'): this {
		return this.add(followStep(this.host, spec));
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
	 * @throws When the step runs before a page is loaded; the run then fails.
	 *
	 * @example
	 * ```ts
	 * Osmotic.get('https://example.com/')
	 * 	.recurse('a:not([rel~="nofollow"])@href', { exclude: [/^\/checkout\//] })
	 * 	.set({ title: 'h1' })
	 * ```
	 */
	recurse(spec = 'a@href', options: RecurseOptions = {}): this {
		return this.add(recurseStep(this.host, spec, options));
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
	 * @throws If no exporter for `type` is loaded.
	 *
	 * @example
	 * ```ts
	 * .export('csv', 'products.csv', { delimiter: ',' })
	 * ```
	 */
	export<T extends string>(type: T, file: string, options?: ExportOptions<T>): this {
		return this.add(exportStep(this.host, type, file, options));
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
	 * @param url - The absolute URL to fetch.
	 * @param priority - Requests with a higher priority get the next free slot first.
	 * Built-in steps use their position in the chain.
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
		const run = this.runState();
		if (run.seen.has(url)) return null; // Duplicates are expected; not reported as skips
		run.seen.add(url);
		if (this.opts.respectRobots && !(await run.robots.allows(url))) {
			run.robotsSkipped++;
			return this.skip(url, 'robots');
		}
		if (run.attempts >= this.opts.maxPages) return this.skip(url, 'maxPages');
		run.attempts++;
		const slot = await run.pool.acquire(priority);
		try {
			if (this.opts.respectRobots && this.opts.respectCrawlDelay) {
				await run.robots.waitCrawlDelay(url);
			}
			const delay = slot.delay ?? this.opts.delay;
			if (delay) await sleep(delay);
			const started = Date.now();
			const res = await this.slotFetch(slot, url);
			const html = (res.headers.get('content-type') || '').includes('html');
			if (!res.ok || !html) {
				res.body?.cancel().catch(() => {}); // Release the unread body and its connection
				return this.skip(url, res.ok ? 'contentType' : 'status', res.status);
			}
			const $ = cheerio.load(await res.text(), {
				pseudos: { ...builtinPseudos, ...this.opts.pseudos },
			});
			run.pages++;
			const finalUrl = res.url || url; // Constructed Responses (e.g. from middleware) have no url
			this.events.emit('page', { url: finalUrl, requestedUrl: url, status: res.status, ms: Date.now() - started });
			return { $, node: $.root(), url: finalUrl, base: pageBase($, finalUrl) };
		} catch (error) {
			if (this.events.has('error')) this.events.emit('error', { url, error });
			else console.error(`Failed ${url}: ${error instanceof Error ? error.message : error}`);
			return null;
		} finally {
			run.pool.release(slot);
		}
	}

	// --- Running --------------------------------------------------------------

	/**
	 * Run the chain. Resolves once every branch has finished. A chain can be run again;
	 * each run starts with no pages seen and fresh exports.
	 *
	 * Exporters are closed and `end` handlers run even if the run fails. After a
	 * successful run it logs a short summary to the console: the number of pages
	 * fetched, and of URLs skipped because of `robots.txt`.
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
			attempts: 0,
			pages: 0,
			robotsSkipped: 0,
		};
		this.state = run;
		for (const target of this.exports) target.reset();
		let failed = false;
		let failure: unknown;
		// A step that throws synchronously rejects only its own branch, as an async step would
		const runFrom =
			(i: number): Next =>
			(ctx) => {
				if (i >= this.steps.length) return Promise.resolve();
				try {
					return this.steps[i](ctx, runFrom(i + 1));
				} catch (err) {
					return Promise.reject(err);
				}
			};
		try {
			await this.events.emitSerial('start', { osmotic: this });
			await runFrom(0)({ data: {} });
		} catch (err) {
			failed = true;
			failure = err;
		}
		// An exporter that fails to close fails the run, unless it had already failed
		for (const err of await this.closeExports()) {
			if (failed) console.error(`osmotic: closing an export failed: ${err instanceof Error ? err.stack : err}`);
			else [failed, failure] = [true, err];
		}
		const stats: RunStats = {
			pages: run.pages,
			robotsSkipped: run.robotsSkipped,
			rows: Object.fromEntries(this.exports.map((t) => [t.file, t.rowCount])),
		};
		await this.events.emitSettled('end', { osmotic: this, stats, ...(failed ? { error: failure } : {}) });
		this.state = null;
		if (failed) throw failure;
		console.log(`Done. Fetched ${run.pages} page(s).`);
		if (run.robotsSkipped) console.log(`Skipped ${run.robotsSkipped} URL(s) disallowed by robots.txt.`);
	}

	// --- Internals ------------------------------------------------------------

	// Load url and continue the chain on it, with from's data carried over.
	// Later steps get priority so branches finish (and free memory) before the
	// crawl widens; first come, first served would queue up the whole site.
	private visit(url: string, from: Context, next: Next, priority: number): Promise<void> {
		return this.fetchPage(url, priority).then((page) => (page ? next({ ...from, ...page }) : undefined));
	}

	private skip(url: string, reason: SkipReason, status?: number): null {
		this.events.emit('skip', status === undefined ? { url, reason } : { url, reason, status });
		return null;
	}

	private runState(): RunState {
		if (!this.state) throw new Error('Pages can only be fetched while run() is in progress');
		return this.state;
	}

	// Fetch through the slot's settings, falling back to the global options
	private slotFetch(slot: Slot, url: string): Promise<Response> {
		const req: FetchRequest = {
			url,
			slot,
			headers: {
				'User-Agent': slot.userAgent ?? this.opts.userAgent,
				...this.opts.headers,
				...slot.headers,
			},
		};
		return fetchThrough([...this.fetchMiddleware, ...this.pluginFetch], req);
	}

	// Register a middleware's own onStart/onEnd hooks as start/end handlers
	private addHooks(mw: FetchMiddleware): void {
		if (mw.onStart) this.on('start', () => mw.onStart!());
		if (mw.onEnd) this.on('end', () => mw.onEnd!());
	}

	// Close every export, even if some fail, and return the errors
	private async closeExports(): Promise<unknown[]> {
		const results = await Promise.allSettled(this.exports.map((t) => t.end()));
		for (const t of this.exports) console.log(t.summary());
		return results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
	}
}
