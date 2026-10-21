import type { Context, Next } from '../types/context.js';
import type { OsmoticOptions } from '../types/options.js';
import type { ExportTarget } from './ExportTarget.js';

// What the built-in commands in src/commands/ reach of the Osmotic instance they're added to
export interface CommandHost {
	// The instance's options, read when the step runs, so later config() calls apply
	readonly opts: OsmoticOptions;
	// Priority for the requests of the step being built: its position in the chain
	priority(): number;
	// Load url and continue the chain on it, with from's data carried over
	visit(url: string, from: Context, next: Next, priority: number): Promise<void>;
	// Osmotic#links(): unique absolute http(s) URLs found by spec on the current page
	links(ctx: Context, spec: string): string[];
	// Register an .export() step's target, so run() resets and closes it
	addExport(target: ExportTarget): void;
}
