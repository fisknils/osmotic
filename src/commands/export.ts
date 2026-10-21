import type { CommandHost } from '../core/command-host.js';
import { exporterFor } from '../core/exporters.js';
import { ExportTarget } from '../core/ExportTarget.js';
import type { Step } from '../types/context.js';
import type { ExportOptions } from '../types/exporters.js';

// Write each data object reaching this step to file, in the format of export type;
// throws now if no exporter for type is loaded
export function exportStep<T extends string>(
	host: CommandHost,
	type: T,
	file: string,
	options?: ExportOptions<T>,
): Step {
	const factory = exporterFor(type);
	const target = new ExportTarget(file, () => factory(file, options));
	host.addExport(target);
	return (ctx, next) => Promise.resolve(target.write(ctx.data)).then(() => next(ctx));
}
