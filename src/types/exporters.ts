import type { Data } from './context.js';

/**
 * Writes the rows of one `.export()` step for one run. Exporters come from plugins,
 * or from `Osmotic.exporter()`.
 */
export interface Exporter {
	/**
	 * Write one data object. Branches reach the step concurrently, so rows arrive in no
	 * particular order. A returned promise is awaited before the branch continues.
	 *
	 * @param data - The row: the data collected on the branch that reached the step.
	 */
	write(data: Data): unknown;
	/** Flush and close. Called once when the run ends, also when it failed; may be async. */
	end(): unknown;
}

/**
 * Creates the {@link Exporter} for an `.export()` step. It is called on the first row of
 * each run, so a run without rows creates no file.
 *
 * @typeParam O - The options the export type takes.
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

/**
 * The options `.export()` takes for type `T`: declared ones, or any object.
 *
 * @typeParam T - The export type name.
 */
export type ExportOptions<T extends string> = T extends keyof ExportTypes ? ExportTypes[T] : Record<string, unknown>;
