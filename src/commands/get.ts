import type { CommandHost } from '../core/command-host.js';
import { withoutPage } from '../core/page.js';
import type { Step } from '../types/context.js';

// Load url, resolved against the current page if there is one
export function getStep(host: CommandHost, url: string): Step {
	const priority = host.priority();
	return (ctx, next) => {
		const from = ctx.base ?? ctx.url;
		const abs = from ? new URL(url, from).href : new URL(url).href;
		return host.visit(abs, withoutPage(ctx), next, priority);
	};
}
