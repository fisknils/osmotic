import { Osmotic, type OsmoticPlugin } from '../src/index.cjs';

const plugin: OsmoticPlugin = {
	name: 'osmotic-plugin-pause',
	commands: { pause: (ms: number) => (ctx, next) => next(ctx) },
};
Osmotic.plugins([plugin, () => plugin]);

// @ts-expect-error: a plugin needs a name
const nameless: OsmoticPlugin = { commands: {} };

// @ts-expect-error: commands return steps
const badCommand: OsmoticPlugin = { name: 'x', commands: { pause: () => 'not a step' } };

// @ts-expect-error: plugins() takes an array
Osmotic.plugins(plugin);
