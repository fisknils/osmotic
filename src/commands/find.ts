import { all, pageOf } from '../core/page.js';
import type { Step } from '../types/context.js';
import { normalizeSelector } from '../utils/normalize-selector.js';

// Continue once per element matching selector
export function findStep(selector: string): Step {
	return (ctx, next) => {
		const { $, node } = pageOf(ctx);
		const els = $(node).find(normalizeSelector(selector)).toArray();
		return all(els.map((el) => next({ ...ctx, node: el })));
	};
}
