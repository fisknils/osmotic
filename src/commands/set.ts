import type { CommandHost } from '../core/command-host.js';
import { pageOf } from '../core/page.js';
import type { Step } from '../types/context.js';
import type { Spec } from '../types/specs.js';
import { pick } from '../utils/pick.js';

// Extract fields relative to the current node and merge them into data
export function setStep(host: CommandHost, fields: Record<string, Spec>): Step {
	return (ctx, next) => {
		const { $, node, base } = pageOf(ctx);
		const resolveBase = host.opts.resolveUrls ? base : null;
		const values = Object.fromEntries(
			Object.entries(fields).map(([key, spec]) => [key, pick($, node, spec, resolveBase)]),
		);
		return next({ ...ctx, data: { ...ctx.data, ...values } });
	};
}
