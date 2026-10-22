import type { Osmotic } from '../core/Osmotic.js';
import { letsGo } from '../core/page.js';
import type { Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.tap}: log `[label] url`, then continue.
 *
 * Lets go of a page whose release is tracked when it returns.
 *
 * @param label - The text in brackets.
 * @returns The step.
 */
export function tapStep(label: string): Step {
	return letsGo('return', (ctx, next) => {
		console.log(`[${label}] ${ctx.url ?? '(no page)'}`);
		return next(ctx);
	});
}
