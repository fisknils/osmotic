import type { Osmotic } from '../core/Osmotic.js';
import type { CommandHost } from '../core/command-host.js';
import { all, letsGo, pageOf, withoutPage } from '../core/page.js';
import type { RecurseOptions } from '../types/commands.js';
import type { Context, Next, Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.recurse}: run the rest of the chain on this page, then
 * follow the links found by `spec` and repeat the step on each new page.
 *
 * @param host - The instance the step is added to.
 * @param spec - Where to find the links: `"selector@attr"`.
 * @param options - `sameDomain` and `exclude`.
 * @returns The step.
 * @throws When the step runs before a page is loaded, or with an invalid selector.
 */
export function recurseStep(
	host: CommandHost,
	spec: string,
	{ sameDomain = true, exclude = [] }: RecurseOptions,
): Step {
	const priority = host.priority();
	const step = (ctx: Context, next: Next): Promise<void> => {
		const hostname = new URL(pageOf(ctx).url).hostname;
		const children = host.links(ctx, spec).filter((url) => {
			const u = new URL(url);
			return (!sameDomain || u.hostname === hostname) && !exclude.some((re) => re.test(u.pathname));
		});
		const carry = withoutPage(ctx);
		const again: Next = (child) => step(child, next);
		return all([next(ctx), ...children.map((url) => host.visit(url, carry, again, priority))]);
	};
	return letsGo('return', step);
}
