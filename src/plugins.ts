import { addExporter, hasExporter, type ExporterFactory } from './exporters.js';
import type { Osmotic } from './osmotic.js';
import type { FetchMiddleware, Step } from './types.js';

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

// Names of loaded plugins, and the inputs they were loaded from
const loadedNames = new Set<string>();
const loadedInputs = new Set<unknown>();

// Fetch middleware from every loaded plugin, in load order
export const pluginMiddleware: FetchMiddleware[] = [];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Turn an input into a checked plugin. An ES module namespace, or a CommonJS
// export of { default }, is unwrapped first.
function resolve(input: unknown): OsmoticPlugin {
	let value = input;
	if (isRecord(value) && typeof value.name !== 'string' && 'default' in value) value = value.default;
	if (typeof value === 'function') value = value();
	if (!isRecord(value) || typeof value.name !== 'string' || !value.name) {
		throw new TypeError('Not an osmotic plugin: expected an object with a name, or a function returning one');
	}
	const { name, commands, exporters, fetch } = value;
	checkFactories(name, 'command', commands);
	checkFactories(name, 'exporter', exporters);
	if (fetch !== undefined && (!Array.isArray(fetch) || fetch.some((mw) => typeof mw !== 'function'))) {
		throw new TypeError(`Plugin "${name}": fetch must be an array of middleware functions`);
	}
	return value as unknown as OsmoticPlugin;
}

// Throws unless map is undefined or an object of functions
function checkFactories(plugin: string, kind: 'command' | 'exporter', map: unknown): void {
	if (map === undefined) return;
	if (!isRecord(map)) throw new TypeError(`Plugin "${plugin}": ${kind}s must be an object`);
	for (const [key, factory] of Object.entries(map)) {
		if (typeof factory !== 'function') {
			throw new TypeError(`Plugin "${plugin}": ${kind} "${key}" must be a function`);
		}
	}
}

// How loadPlugins() reaches the Osmotic class, which imports this module
export interface PluginHost {
	hasCommand(name: string): boolean;
	addCommand(name: string, factory: (this: Osmotic, ...args: any[]) => Step): void;
}

// Check every plugin in list before loading any, so a failed call loads nothing.
// Inputs loaded before are skipped; a different plugin with a taken name throws.
export function loadPlugins(list: readonly PluginInput[], host: PluginHost): void {
	if (!Array.isArray(list)) throw new TypeError('Osmotic.plugins() expects an array of plugins');
	const batch: { input: unknown; plugin: OsmoticPlugin }[] = [];
	const names = new Set<string>();
	const commands = new Set<string>();
	const types = new Set<string>();
	for (const input of list) {
		if (loadedInputs.has(input) || batch.some((b) => b.input === input)) continue;
		const plugin = resolve(input);
		if (loadedNames.has(plugin.name) || names.has(plugin.name)) {
			throw new Error(`Plugin "${plugin.name}" is already loaded`);
		}
		for (const cmd of Object.keys(plugin.commands ?? {})) {
			if (host.hasCommand(cmd) || commands.has(cmd)) {
				throw new Error(`Plugin "${plugin.name}": command "${cmd}" already exists`);
			}
			commands.add(cmd);
		}
		for (const type of Object.keys(plugin.exporters ?? {})) {
			if (hasExporter(type) || types.has(type)) {
				throw new Error(`Plugin "${plugin.name}": exporter "${type}" already exists`);
			}
			types.add(type);
		}
		names.add(plugin.name);
		batch.push({ input, plugin });
	}
	for (const { input, plugin } of batch) {
		for (const [cmd, factory] of Object.entries(plugin.commands ?? {})) host.addCommand(cmd, factory);
		for (const [type, factory] of Object.entries(plugin.exporters ?? {})) addExporter(type, factory);
		pluginMiddleware.push(...(plugin.fetch ?? []));
		loadedNames.add(plugin.name);
		loadedInputs.add(input);
	}
}
