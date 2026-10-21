import { all, pageOf } from '../core/page.js';
import type { Step } from '../types/context.js';
import { normalizeSelector } from '../utils/normalize-selector.js';

/**
 * Builds the step of {@link Osmotic.find}: continue once per element matching `selector`.
 *
 * @param selector - A CSS selector, with the selector extras.
 * @returns The step.
 */
export function findStep(selector: string): Step {
	return (ctx, next) => {
		const { $, node } = pageOf(ctx);
		const els = $(node).find(normalizeSelector(selector)).toArray();
		return all(els.map((el) => next({ ...ctx, node: el })));
	};
}
