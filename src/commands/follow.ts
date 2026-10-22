import type { Osmotic } from '../core/Osmotic.js';
import type { CommandHost } from '../core/command-host.js';
import { all, letsGo, withoutPage } from '../core/page.js';
import type { Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.follow}: load every URL found by `spec`, carrying the
 * data collected so far but not the page.
 *
 * @param host - The instance the step is added to.
 * @param spec - Where to find the links: `"selector@attr"`.
 * @returns The step.
 * @throws When the step runs before a page is loaded, or with an invalid selector.
 */
export function followStep(host: CommandHost, spec: string): Step {
	const priority = host.priority();
	return letsGo('return', (ctx, next) => {
		const carry = withoutPage(ctx);
		return all(host.links(ctx, spec).map((url) => host.visit(url, carry, next, priority)));
	});
}
