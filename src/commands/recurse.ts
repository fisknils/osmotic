import type { CommandHost } from '../core/command-host.js';
import { all, pageOf, withoutPage } from '../core/page.js';
import type { RecurseOptions } from '../types/commands.js';
import type { Context, Next, Step } from '../types/context.js';

// Run the rest of the chain on this page, then follow links found by spec and repeat
// this step on each new page
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
	return step;
}
