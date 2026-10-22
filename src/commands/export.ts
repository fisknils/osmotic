import type { Osmotic } from '../core/Osmotic.js';
import type { CommandHost } from '../core/command-host.js';
import { exporterFor } from '../core/exporters.js';
import { ExportTarget } from '../core/ExportTarget.js';
import { letsGo } from '../core/page.js';
import type { Step } from '../types/context.js';
import type { ExportOptions } from '../types/exporters.js';

/**
 * Builds the step of {@link Osmotic.export}: write each data object reaching it to `file`,
 * and registers the export with `host` so runs reset and close it.
 *
 * Lets go of a page whose release is tracked when it continues, or when writing fails.
 *
 * @typeParam T - The export type.
 * @param host - The instance the step is added to.
 * @param type - The export type, such as `'csv'`.
 * @param file - The file to write.
 * @param options - Passed to the exporter.
 * @returns The step.
 * @throws If no exporter for `type` is loaded, when the command is called. When the step
 * runs, what the exporter's factory or `write()` throws; the run then fails.
 */
export function exportStep<T extends string>(
	host: CommandHost,
	type: T,
	file: string,
	options?: ExportOptions<T>,
): Step {
	const factory = exporterFor(type);
	const target = new ExportTarget(file, () => factory(file, options));
	host.addExport(target);
	return letsGo('next', (ctx, next) => Promise.resolve(target.write(ctx.data)).then(() => next(ctx)));
}
