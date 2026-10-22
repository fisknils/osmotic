import type { Osmotic } from '../core/Osmotic.js';
import type { CommandHost } from '../core/command-host.js';
import { letsGo, withoutPage } from '../core/page.js';
import type { Step } from '../types/context.js';

/**
 * Builds the step of {@link Osmotic.get}: load `url` and continue the chain on it.
 *
 * @param host - The instance the step is added to.
 * @param url - The URL to load; a relative one resolves against the current page.
 * @returns The step.
 * @throws When the step runs with a relative URL and no page loaded, or a malformed URL.
 */
export function getStep(host: CommandHost, url: string): Step {
	const priority = host.priority();
	return letsGo('return', (ctx, next) => {
		const from = ctx.base ?? ctx.url;
		const abs = from ? new URL(url, from).href : new URL(url).href;
		return host.visit(abs, withoutPage(ctx), next, priority);
	});
}
