import type { Osmotic } from './Osmotic.js';
import type { Context, Next } from '../types/context.js';
import type { OsmoticOptions } from '../types/options.js';
import type { ExportTarget } from './ExportTarget.js';

/**
 * What the built-in commands in `src/commands/` reach of the {@link Osmotic} instance
 * they're added to. Internal: not exported from the entry points.
 */
export interface CommandHost {
	/** The instance's options, read when a step runs, so later `config()` calls apply. */
	readonly opts: OsmoticOptions;
	/**
	 * The priority for the requests of the step being built: its position in the chain,
	 * so later steps get free slots first.
	 *
	 * @returns The number of steps added so far.
	 */
	priority(): number;
	/**
	 * Load `url` and continue the chain on it, with `from`'s data carried over.
	 *
	 * @param url - The absolute URL to load.
	 * @param from - The context to carry over, without its page.
	 * @param next - Continues the chain on the loaded page.
	 * @param priority - The priority of the request, from {@link CommandHost.priority}.
	 * @returns A promise that settles when the chain on the page has finished, or once the
	 * fetch attempt is over if the page was skipped or failed.
	 */
	visit(url: string, from: Context, next: Next, priority: number): Promise<void>;
	/**
	 * {@link Osmotic.links}: unique absolute http(s) URLs found by `spec` on the current page.
	 *
	 * @param ctx - The context of the running step.
	 * @param spec - Where to find the links: `"selector@attr"`.
	 * @returns The URLs.
	 */
	links(ctx: Context, spec: string): string[];
	/**
	 * Register the target of an `.export()` step, so each run resets and closes it.
	 *
	 * @param target - The step's export target.
	 */
	addExport(target: ExportTarget): void;
}
