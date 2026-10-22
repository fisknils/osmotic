import type { Context, Next, Step } from '../types/context.js';
import { letGoOf } from './page.js';

type Callback = () => unknown;

// A tracked page: how many steps still hold it, and its callbacks until it's released
interface Held {
	holds: number;
	callbacks: Callback[] | null;
}

// Release tracking for one run. Only pages whose fetch middleware called req.onRelease()
// are tracked, keyed by their frozen `attached` object, so spreading a loadPage() result
// keeps the tracking and withoutPage() drops it. A run that tracks nothing pays for one
// check of `tracking` per step. Nothing here may reference a page's DOM.
export class ReleaseTracker {
	tracking = false;
	private readonly pages = new WeakMap<object, Held>();
	private readonly open = new Set<Held>();
	private readonly deferred: Callback[] = [];
	private readonly running = new Set<Promise<void>>();
	private closed = false;

	// Track the page with these attached values; it's released once no step holds it
	track(attached: object, callbacks: Callback[]): void {
		if (this.closed) return this.release(callbacks);
		const held: Held = { holds: 0, callbacks };
		this.pages.set(attached, held);
		this.open.add(held);
		this.tracking = true;
	}

	// Release these callbacks when the run ends, for pages from the public fetchPage()
	defer(callbacks: Callback[]): void {
		if (this.closed) this.release(callbacks);
		else this.deferred.push(...callbacks);
	}

	heldBy(ctx: Context): Held | undefined {
		return this.tracking && ctx.attached ? this.pages.get(ctx.attached) : undefined;
	}

	// Continue on a freshly loaded page, holding it meanwhile, so a page no step takes
	// over is released as soon as next() returns
	deliver(ctx: Context, next: Next): Promise<void> {
		const held = this.heldBy(ctx);
		if (!held) return next(ctx);
		this.hold(held);
		try {
			return next(ctx);
		} finally {
			this.letGo(held);
		}
	}

	// Run a step on a tracked page, holding the page until the step lets go of it (see LetGo)
	runStep(held: Held, step: Step, ctx: Context, next: Next): Promise<void> {
		const when = letGoOf(step);
		this.hold(held);
		let holding = true;
		const letGo = () => {
			if (!holding) return;
			holding = false;
			this.letGo(held);
		};
		let returned = false;
		let passed = false;
		// The next step takes its own hold before this one lets go, so the count can't drop to 0 in between
		const passOn: Next =
			when === 'next'
				? (c) => {
						const branch = next(c);
						passed = true;
						if (returned) letGo();
						return branch;
					}
				: next;
		let result: Promise<void>;
		try {
			result = step(ctx, passOn);
		} catch (err) {
			letGo();
			return Promise.reject(err);
		}
		returned = true;
		if (when === 'return' || passed) {
			letGo();
			return result;
		}
		return Promise.resolve(result).finally(letGo);
	}

	// Run callbacks now, each once; failures are logged, never thrown into the run
	release(callbacks: Callback[]): void {
		for (const fn of callbacks) {
			const done = Promise.resolve()
				.then(fn)
				.then(
					() => {},
					(err) => console.error(`osmotic: a release callback failed: ${err instanceof Error ? err.stack : err}`),
				)
				.finally(() => this.running.delete(done));
			this.running.add(done);
		}
	}

	// At the end of the run: release every page still open and wait for all callbacks.
	// Pages that are tracked after this, by branches still running after a failure, are
	// released right away.
	async close(): Promise<void> {
		this.closed = true;
		for (const held of this.open) this.releaseHeld(held);
		this.release(this.deferred.splice(0));
		while (this.running.size) await Promise.all(this.running);
	}

	private hold(held: Held): void {
		if (held.callbacks) held.holds++;
	}

	private letGo(held: Held): void {
		if (held.callbacks && --held.holds === 0) this.releaseHeld(held);
	}

	private releaseHeld(held: Held): void {
		const callbacks = held.callbacks!;
		held.callbacks = null;
		this.open.delete(held);
		this.release(callbacks);
	}
}
