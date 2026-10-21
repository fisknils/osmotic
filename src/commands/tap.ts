import type { Step } from '../types/context.js';

// Log "[label] url" for each branch reaching this step, then continue
export function tapStep(label: string): Step {
	return (ctx, next) => {
		console.log(`[${label}] ${ctx.url ?? '(no page)'}`);
		return next(ctx);
	};
}
