import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { CsvSink, type CsvOptions } from './csv.js';
import { Emitter, type Handler, type OsmoticEvent, type RunStats, type SkipReason } from './events.js';
import { links, pick } from './extract.js';
import { fetchThrough } from './http.js';
import { loadPlugins, pluginMiddleware, type PluginInput } from './plugins.js';
import { RobotsCache } from './robots.js';
import { builtinPseudos, normalizeSelector } from './selectors.js';
import { SlotPool } from './slots.js';
import { pageBase } from './urls.js';
import { sleep } from './util.js';
import type {
	Context,
	Data,
	FetchMiddleware,
	FetchRequest,
	Next,
	OsmoticOptions,
	Page,
	PageNode,
	Slot,
	Spec,
	Step,
} from './types.js';

/**
 * The test for {@link Osmotic.filter}: a selector that passes when the current node
 * contains a match, or a function that passes when it returns true.
 */
export type FilterTest = string | (($: CheerioAPI, node: PageNode, data: Data) => boolean | Promise<boolean>);

/** Options for {@link Osmotic.recurse}. */
export interface RecurseOptions {
	/**
	 * Only follow links to the current page's host.
	 * @defaultValue `true`
	 */
	sameDomain?: boolean;
	/**
	 * Skip URLs whose pathname matches any of these.
	 * @defaultValue `[]`
	 */
	exclude?: RegExp[];
}

// State that lives for a single run()
interface RunState {
	seen: Set<string>;
	robots: RobotsCache;
	pool: SlotPool;
	attempts: number;
	pages: number;
	robotsSkipped: number;
}

// The page fields of ctx; throws when a step that needs a page runs before get()
function pageOf(ctx: Context): Page & Context {
	if (!ctx.$ || !ctx.node || !ctx.url) {
		throw new Error('No page loaded yet; start the chain with get()');
	}
	return { ...ctx, base: ctx.base ?? ctx.url } as Page & Context;
}

// ctx without its page, to carry into pages loaded from it. Requests waiting for a
// slot then hold only the collected data, not the parent page's DOM.
function withoutPage({ $, node, url, base, ...rest }: Context): Context {
	return rest;
}

const all = (branches: Promise<unknown>[]): Promise<void> => Promise.all(branches).then(() => undefined);

// Built-in steps return next()'s promise instead of awaiting it. A suspended async
// frame keeps ctx reachable, and with it the page's whole DOM, until every branch
// below it has finished, which on a long crawl is most pages ever loaded.

/**
 * A chainable scraper. Each command adds a step to the chain; {@link Osmotic.run}
 * starts at the first step and runs every branch to the end.
 *
 * @example
 * ```ts
 * await Osmotic.get('https://news.ycombinator.com')
 * 	.find('tr.athing')
 * 	.set({ title: '.titleline > a' })
 * 	.csv('hn.csv')
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
	private readonly sinks: CsvSink[] = [];
	private readonly fetchMiddleware: FetchMiddleware[] = [];
	private readonly events = new Emitter();
	private state: RunState | null = null;
	// Middleware from plugins loaded before this chain was created; runs after fetchMiddleware
	private readonly pluginFetch: FetchMiddleware[] = [...pluginMiddleware];

	constructor() {
		for (const mw of this.pluginFetch) this.addHooks(mw);
	}

	/** Start a new chain by loading `url`. Shorthand for `new Osmotic().get(url)`. */
	static get(url: string): Osmotic {
		return new Osmotic().get(url);
	}

	/** Merge `opts` into the current options. */
	config(opts: Partial<OsmoticOptions>): this {
		Object.assign(this.opts, opts);
		return this;
	}

	/** Append a step to the chain. Same as {@link Osmotic.use}. */
	add(step: Step): this {
		this.steps.push(step);
		return this;
	}

	// --- Extension points -----------------------------------------------------

	/**
	 * Insert a custom chain step. Call `next(ctx)` zero times to stop the branch,
	 * once to continue, or several times to branch.
	 *
	 * @example
	 * ```ts
	 * .use(async (ctx, next) => {
	 * 	if (/ai|llm/i.test(ctx.data.title)) await next(ctx);
	 * })
	 * ```
	 */
	use(fn: Step): this {
		return this.add(fn);
	}

	/**
	 * Wrap every HTTP request. `next(req)` returns the `Response`, and middleware runs
	 * in the order added. A middleware's own `onStart` and `onEnd` hooks are
	 * registered as `start` and `end` handlers.
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
	 * holds up the crawl.
	 */
	on<E extends OsmoticEvent>(event: E, handler: Handler<E>): this {
		this.events.on(event, handler);
		return this;
	}

	/** Remove a handler added with {@link Osmotic.on}. */
	off<E extends OsmoticEvent>(event: E, handler: Handler<E>): this {
		this.events.off(event, handler);
		return this;
	}

	/**
	 * Register a reusable chainable command on all Osmotic instances.
	 *
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
	 * Load plugins: their commands become available on every instance, and their fetch
	 * middleware is added to every chain created afterwards, so load plugins first.
	 *
	 * Each entry is a plugin object, or a function returning one, which is called
	 * without arguments. Loading the same entry again does nothing.
	 *
	 * @throws If an entry is not a valid plugin, another plugin with the same name is
	 * loaded, or a command name is taken. Nothing in the list is loaded then.
	 *
	 * @example
	 * ```ts
	 * Osmotic.plugins([require('osmotic-plugin-playwright')]);
	 * ```
	 */
	static plugins(list: PluginInput[]): typeof Osmotic {
		loadPlugins(
			list,
			(name) => name in Osmotic.prototype,
			(name, factory) => Osmotic.command(name, factory),
		);
		return Osmotic;
	}

	// --- Commands -------------------------------------------------------------

	/** Load a page. Relative URLs resolve against the current page. */
	get(url: string): this {
		const priority = this.steps.length;
		return this.add((ctx, next) => {
			const from = ctx.base ?? ctx.url;
			const abs = from ? new URL(url, from).href : new URL(url).href;
			return this.visit(abs, withoutPage(ctx), next, priority);
		});
	}

	/** Continue the chain once per element matching `selector`. */
	find(selector: string): this {
		return this.add((ctx, next) => {
			const { $, node } = pageOf(ctx);
			const els = $(node).find(normalizeSelector(selector)).toArray();
			return all(els.map((el) => next({ ...ctx, node: el })));
		});
	}

	/**
	 * Continue only if `test` passes: a selector passes when the current node contains
	 * a match, and a function `($, node, data)` passes when it returns true.
	 */
	filter(test: FilterTest): this {
		return this.add((ctx, next) => {
			const { $, node } = pageOf(ctx);
			if (typeof test !== 'function') {
				return $(node).find(normalizeSelector(test)).length > 0 ? next(ctx) : Promise.resolve();
			}
			return Promise.resolve(test($, node, ctx.data)).then((ok) => (ok ? next(ctx) : undefined));
		});
	}

	/**
	 * Extract fields relative to the current node and merge them into `data`.
	 *
	 * @example
	 * ```ts
	 * .set({ title: 'h1', image: 'meta[property="og:image"]@content', tags: ['.tag'] })
	 * ```
	 */
	set(fields: Record<string, Spec>): this {
		return this.add((ctx, next) => {
			const { $, node, base } = pageOf(ctx);
			const resolveBase = this.opts.resolveUrls ? base : null;
			const values = Object.fromEntries(
				Object.entries(fields).map(([key, spec]) => [key, pick($, node, spec, resolveBase)]),
			);
			return next({ ...ctx, data: { ...ctx.data, ...values } });
		});
	}

	/** Load every URL found by `spec`. Data collected so far carries over. */
	follow(spec = 'a@href'): this {
		const priority = this.steps.length;
		return this.add((ctx, next) => {
			const carry = withoutPage(ctx);
			return all(this.links(ctx, spec).map((url) => this.visit(url, carry, next, priority)));
		});
	}

	/**
	 * Run the rest of the chain on this page, then follow links found by `spec` and
	 * repeat this step on each new page. Each URL is visited once per run.
	 */
	recurse(spec = 'a@href', { sameDomain = true, exclude = [] }: RecurseOptions = {}): this {
		const priority = this.steps.length;
		const step = (ctx: Context, next: Next): Promise<void> => {
			const host = new URL(pageOf(ctx).url).hostname;
			const children = this.links(ctx, spec).filter((url) => {
				const u = new URL(url);
				return (!sameDomain || u.hostname === host) && !exclude.some((re) => re.test(u.pathname));
			});
			const carry = withoutPage(ctx);
			const again: Next = (child) => step(child, next);
			return all([next(ctx), ...children.map((url) => this.visit(url, carry, again, priority))]);
		};
		return this.add(step);
	}

	/** Log `[label] url` for each branch reaching this step, then continue. */
	tap(label = 'tap'): this {
		return this.add((ctx, next) => {
			console.log(`[${label}] ${ctx.url ?? '(no page)'}`);
			return next(ctx);
		});
	}

	/** Call `cb` with the collected data, then continue. `cb` may be async. */
	data(cb: (data: Data, ctx: Context) => unknown): this {
		return this.add((ctx, next) => Promise.resolve(cb(ctx.data, ctx)).then(() => next(ctx)));
	}

	/**
	 * Write each data object reaching this step as a CSV row, streamed to disk.
	 * Columns come from `options.columns`, or from the keys of the first row.
	 */
	csv(path: string, options: CsvOptions = {}): this {
		const sink = new CsvSink(path, options);
		this.sinks.push(sink);
		return this.add((ctx, next) => {
			sink.write(ctx.data);
			return next(ctx);
		});
	}

	// --- Helpers for custom commands -------------------------------------------

	/**
	 * Unique absolute http(s) URLs found by `spec`, relative to the current node.
	 * @throws If no page is loaded yet.
	 */
	links(ctx: Context, spec: string): string[] {
		const { $, node, base } = pageOf(ctx);
		return links($, node, spec, base);
	}

	/**
	 * Fetch and parse `url`.
	 *
	 * @param priority - Requests with a higher priority get the next free slot first.
	 * Built-in steps use their position in the chain.
	 * @returns The page, or `null` if the URL was already seen, is disallowed, exceeds
	 * `maxPages`, fails, or isn't HTML.
	 * @throws If called outside {@link Osmotic.run}.
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
	 * Run the chain. Resolves once every branch has finished.
	 *
	 * CSV files are closed and `end` handlers run even if the run fails.
	 * @throws What a step or `start` handler threw.
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
		for (const sink of this.sinks) sink.reset();
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
			failure = err;
			throw err;
		} finally {
			await this.closeSinks();
			const stats: RunStats = {
				pages: run.pages,
				robotsSkipped: run.robotsSkipped,
				rows: Object.fromEntries(this.sinks.map((s) => [s.path, s.rowCount])),
			};
			await this.events.emitSettled('end', {
				osmotic: this,
				stats,
				...(failure !== undefined ? { error: failure } : {}),
			});
			this.state = null;
		}
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

	private async closeSinks(): Promise<void> {
		await Promise.all(this.sinks.map((s) => s.end()));
		for (const s of this.sinks) console.log(s.summary());
	}
}
