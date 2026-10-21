import type { CommandHost } from '../core/command-host.js';
import { pageOf } from '../core/page.js';
import type { Step } from '../types/context.js';
import type { Spec } from '../types/specs.js';
import { pick } from '../utils/pick.js';

/**
 * Builds the step of {@link Osmotic.set}: extract `fields` relative to the current node
 * and merge them into `data`.
 *
 * @param host - The instance the step is added to; its `resolveUrls` option is read when
 * the step runs.
 * @param fields - The specs to extract, by field name.
 * @returns The step.
 */
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
