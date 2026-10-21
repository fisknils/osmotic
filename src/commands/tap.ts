import type { Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.tap}: log `[label] url`, then continue.
 *
 * @param label - The text in brackets.
 * @returns The step.
 */
export function tapStep(label: string): Step {
	return (ctx, next) => {
		console.log(`[${label}] ${ctx.url ?? '(no page)'}`);
		return next(ctx);
	};
}
