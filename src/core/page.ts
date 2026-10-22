import type { Context, Page, Step } from '../types/context.js';

// Helpers for the steps in src/commands/.
//
// Built-in steps return next()'s promise instead of awaiting it. A suspended async
// frame keeps ctx reachable, and with it the page's whole DOM, until every branch
// below it has finished, which on a long crawl is most pages ever loaded.

// The page fields of ctx; throws when a step that needs a page runs before get()
export function pageOf(ctx: Context): Page & Context {
	if (!ctx.$ || !ctx.node || !ctx.url) {
		throw new Error('No page loaded yet; start the chain with get()');
	}
	return { ...ctx, base: ctx.base ?? ctx.url } as Page & Context;
}

// ctx without its page, to carry into pages loaded from it. Requests waiting for a
// slot then hold only the collected data, not the parent page's DOM.
export function withoutPage({ $, node, url, base, attached, ...rest }: Context): Context {
	return rest;
}

// Wait for every branch; resolves to undefined so steps keep the Promise<void> type
export const all = (branches: Promise<unknown>[]): Promise<void> => Promise.all(branches).then(() => undefined);

// When a built-in step lets go of a page whose release is tracked (see ReleaseTracker):
// - 'return': when it returns, for steps that call next() right away for every branch, or
//   that pass on only the collected data
// - 'next': at its first next() call, or when it settles without one, for steps that may
//   wait for a function before they continue
// Any other step holds the page until its promise settles.
export type LetGo = 'return' | 'next';

const letGoWhen = new WeakMap<Step, LetGo>();

// Mark a built-in step with when it lets go of a page
export function letsGo(when: LetGo, step: Step): Step {
	letGoWhen.set(step, when);
	return step;
}

export const letGoOf = (step: Step): LetGo | undefined => letGoWhen.get(step);
