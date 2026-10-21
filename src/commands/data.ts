import type { Context, Data, Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.data}: call `cb` with the collected data, wait for it,
 * then continue.
 *
 * @param cb - Called as `cb(data, ctx)`; may be async.
 * @returns The step.
 */
export function dataStep(cb: (data: Data, ctx: Context) => unknown): Step {
	return (ctx, next) => Promise.resolve(cb(ctx.data, ctx)).then(() => next(ctx));
}
