import { Osmotic, type ExportOptions } from '../src/index.cjs';

declare module '../src/exporters.js' {
	interface ExportTypes {
		'type-test-declared': { pretty?: boolean };
	}
}

Osmotic.exporter<{ pretty?: boolean }>('type-test-declared', (file, options) => ({
	write: () => options?.pretty,
	end: () => file,
}));

const chain = new Osmotic();
chain.export('type-test-declared', 'out.json', { pretty: true });
chain.export('type-test-declared', 'out.json');
chain.export('type-test-undeclared', 'out.x', { anything: 1, goes: 'here' });

// @ts-expect-error: pretty is a boolean
chain.export('type-test-declared', 'out.json', { pretty: 'yes' });

// @ts-expect-error: undeclared types take an object, not a string
chain.export('type-test-undeclared', 'out.x', 'options');

// @ts-expect-error: the file is required
chain.export('type-test-declared');

const declared: ExportOptions<'type-test-declared'> = { pretty: false };
const undeclared: ExportOptions<'type-test-undeclared'> = { whatever: true };
void [declared, undeclared];
