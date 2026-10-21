import type { ExporterFactory } from '../types/exporters.js';

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
