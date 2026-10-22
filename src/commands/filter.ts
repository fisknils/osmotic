import type { Osmotic } from '../core/Osmotic.js';
import { letsGo, pageOf } from '../core/page.js';
import type { FilterTest } from '../types/commands.js';
import type { Step } from '../types/context.js';
import { normalizeSelector } from '../utils/normalize-selector.js';

/**
 * Builds the step of {@link Osmotic.filter}: continue only if `test` passes.
 *
 * Lets go of a page whose release is tracked when it continues, or when it settles without continuing.
 *
 * @param test - A selector that must match inside the current node, or a function that
 * must return or resolve to a truthy value.
 * @returns The step.
 * @throws When the step runs before a page is loaded, with an invalid selector, or with
 * what a test function throws or rejects with.
 */
export function filterStep(test: FilterTest): Step {
	return letsGo('next', (ctx, next) => {
		const { $, node } = pageOf(ctx);
		if (typeof test !== 'function') {
			return $(node).find(normalizeSelector(test)).length > 0 ? next(ctx) : Promise.resolve();
		}
		return Promise.resolve(test($, node, ctx.data)).then((ok) => (ok ? next(ctx) : undefined));
	});
}
