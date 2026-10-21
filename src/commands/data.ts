import type { Context, Data, Step } from '../types/context.js';

// Call cb with the collected data, then continue; cb may be async
export function dataStep(cb: (data: Data, ctx: Context) => unknown): Step {
	return (ctx, next) => Promise.resolve(cb(ctx.data, ctx)).then(() => next(ctx));
}
