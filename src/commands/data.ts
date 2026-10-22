import type { Osmotic } from '../core/Osmotic.js';
import { letsGo } from '../core/page.js';
import type { Context, Data, Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.data}: call `cb` with the collected data, wait for it,
 * then continue.
 *
 * @param cb - Called as `cb(data, ctx)`; may be async.
 * @returns The step.
 * @throws When the step runs, what `cb` throws or rejects with.
 */
export function dataStep(cb: (data: Data, ctx: Context) => unknown): Step {
	return letsGo('next', (ctx, next) => Promise.resolve(cb(ctx.data, ctx)).then(() => next(ctx)));
}
