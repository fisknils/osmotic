import { pageOf } from '../core/page.js';
import type { FilterTest } from '../types/commands.js';
import type { Step } from '../types/context.js';
import { normalizeSelector } from '../utils/normalize-selector.js';

// Continue only if test passes: a selector when the node contains a match, a function when it returns true
export function filterStep(test: FilterTest): Step {
	return (ctx, next) => {
		const { $, node } = pageOf(ctx);
		if (typeof test !== 'function') {
			return $(node).find(normalizeSelector(test)).length > 0 ? next(ctx) : Promise.resolve();
		}
		return Promise.resolve(test($, node, ctx.data)).then((ok) => (ok ? next(ctx) : undefined));
	};
}
