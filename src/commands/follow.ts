import type { CommandHost } from '../core/command-host.js';
import { all, withoutPage } from '../core/page.js';
import type { Step } from '../types/context.js';

// Load every URL found by spec, carrying the data collected so far
export function followStep(host: CommandHost, spec: string): Step {
	const priority = host.priority();
	return (ctx, next) => {
		const carry = withoutPage(ctx);
		return all(host.links(ctx, spec).map((url) => host.visit(url, carry, next, priority)));
	};
}
