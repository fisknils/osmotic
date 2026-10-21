import type { Osmotic } from '../core/Osmotic.js';
import type { FetchMiddleware } from './fetch.js';
import type { Step } from './context.js';
import type { ExporterFactory } from './exporters.js';

/**
 * A plugin: commands, exporters and fetch middleware packaged for reuse, usually as an npm
 * package named `osmotic-plugin-<name>`. Load it with {@link Osmotic.plugins}.
 *
 * @example
 * ```ts
 * import type { OsmoticPlugin } from 'osmotic';
 *
 * const plugin: OsmoticPlugin = {
 * 	name: 'osmotic-plugin-pause',
 * 	commands: {
 * 		pause: (ms: number) => (ctx, next) => sleep(ms).then(() => next(ctx)),
 * 	},
 * };
 *
 * module.exports = plugin;
 * ```
 */
export interface OsmoticPlugin {
	/** Unique name, normally the npm package name. */
	name: string;
	/**
	 * Chainable commands, by method name. Each works like a factory passed to
	 * {@link Osmotic.command}: it returns the step, with `this` bound to the instance.
	 */
	commands?: Record<string, (this: Osmotic, ...args: any[]) => Step>;
	/**
	 * Export types for `.export(type, file, options)`, by type name. Each works like a
	 * factory passed to {@link Osmotic.exporter}.
	 */
	exporters?: Record<string, ExporterFactory>;
	/**
	 * Fetch middleware for every chain created after the plugin is loaded. It runs after
	 * the chain's own `useFetch()` middleware, closest to the network, and its `onStart`
	 * and `onEnd` hooks run on every run of every chain.
	 */
	fetch?: FetchMiddleware[];
}

/**
 * What {@link Osmotic.plugins} accepts: a plugin, or a function that returns one.
 * A function is called without arguments, so a configurable plugin can export a
 * factory with default options and still be loaded with a plain `require()`.
 */
export type PluginInput = OsmoticPlugin | (() => OsmoticPlugin);
