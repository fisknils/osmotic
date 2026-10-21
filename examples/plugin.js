const { Osmotic } = require('../dist/index.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A plugin as it would be published, e.g. as osmotic-plugin-politeness. Exporting a
// function lets callers pass options, and plugins() calls it with none.
const politeness = ({ pauseMs = 200 } = {}) => {
	let requests = 0;
	const counter = Object.assign(
		async (req, next) => {
			requests++;
			return next(req);
		},
		{
			onStart: () => (requests = 0),
			onEnd: () => console.log(`${requests} request(s) made`),
		},
	);
	return {
		name: 'osmotic-plugin-politeness',
		commands: {
			pause:
				(ms = pauseMs) =>
				(ctx, next) =>
					sleep(ms).then(() => next(ctx)),
		},
		fetch: [counter],
	};
};

Osmotic.plugins([politeness]);

Osmotic.get('https://news.ycombinator.com')
	.pause()
	.find('tr.athing')
	.set({ title: '.titleline > a' })
	.data((item) => console.log(item))
	.config({ maxPages: 1 })
	.run();
