import type { Data } from './types.js';

/**
 * Writes the rows of one `.export()` step for one run. Exporters come from plugins,
 * or from `Osmotic.exporter()`.
 */
export interface Exporter {
	/**
	 * Write one data object. Branches reach the step concurrently, so rows arrive in no
	 * particular order. A returned promise is awaited before the branch continues.
	 */
	write(data: Data): unknown;
	/** Flush and close. Called once when the run ends, also when it failed; may be async. */
	end(): unknown;
}

/**
 * Creates the {@link Exporter} for an `.export()` step. It is called on the first row of
 * each run, so a run without rows creates no file.
 *
 * @param file - The file passed to `.export()`.
 * @param options - The options passed to `.export()`, if any.
 */
export type ExporterFactory<O = any> = (file: string, options: O | undefined) => Exporter;

/**
 * Options for each export type, by type name. It is empty here; a plugin declares its
 * types through interface merging, so `.export()` checks their options:
 *
 * ```ts
 * declare module 'osmotic' {
 * 	interface ExportTypes {
 * 		csv: CsvOptions;
 * 	}
 * }
 * ```
 */
export interface ExportTypes {}

/** The options `.export()` takes for type `T`: declared ones, or any object. */
export type ExportOptions<T extends string> = T extends keyof ExportTypes ? ExportTypes[T] : Record<string, unknown>;

// Registered exporters, by type
const factories = new Map<string, ExporterFactory>();

export const hasExporter = (type: string): boolean => factories.has(type);

export function addExporter(type: string, factory: ExporterFactory): void {
	if (factories.has(type)) throw new Error(`Osmotic exporter "${type}" already exists`);
	factories.set(type, factory);
}

export function exporterFor(type: string): ExporterFactory {
	const factory = factories.get(type);
	if (!factory) {
		throw new Error(
			`No exporter for "${type}". Load a plugin that provides it with Osmotic.plugins() before building the chain`,
		);
	}
	return factory;
}

// One .export() step: creates its exporter on the first row of each run and counts rows
export class ExportTarget {
	private exporter: Exporter | null = null;
	private rows = 0;

	constructor(
		readonly file: string,
		private readonly create: () => Exporter,
	) {}

	// Forget the previous run so the next row starts a fresh exporter
	reset(): void {
		this.exporter = null;
		this.rows = 0;
	}

	write(data: Data): unknown {
		this.exporter ??= this.create();
		const result = this.exporter.write(data);
		this.rows++;
		return result;
	}

	async end(): Promise<void> {
		if (this.exporter) await this.exporter.end();
	}

	get rowCount(): number {
		return this.rows;
	}

	summary(): string {
		return this.exporter ? `Wrote ${this.rows} row(s) to ${this.file}` : `No rows for ${this.file}`;
	}
}
