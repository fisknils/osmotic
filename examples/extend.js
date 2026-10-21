const { Osmotic } = require('../dist/index.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Custom command: wait before continuing the branch
Osmotic.command('pause', (ms) => (ctx, next) => sleep(ms).then(() => next(ctx)));

// Fetch middleware: time each request
const timing = async (req, next) => {
	const t0 = Date.now();
	const res = await next(req);
	console.log(`${res.status} ${Date.now() - t0} ms  slot ${req.slot.id}  ${req.url}`);
	return res;
};

// Fetch middleware: retry on 429 and 5xx with exponential backoff
const retry =
	(times = 2) =>
	async (req, next) => {
		for (let attempt = 0; ; attempt++) {
			const res = await next(req);
			if ((res.status !== 429 && res.status < 500) || attempt >= times) return res;
			await sleep(1000 * 2 ** attempt);
		}
	};

Osmotic.get('https://news.ycombinator.com')
	.useFetch(retry(2))
	.useFetch(timing)
	.tap('front page')
	.pause(100)
	.find('tr.athing')
	.set({ title: '.titleline > a' })
	// Inline step: only keep stories whose title mentions a keyword
	.use(async (ctx, next) => {
		if (/ai|llm|model/i.test(ctx.data.title)) await next(ctx);
	})
	.data((item) => console.log(item))
	.config({ maxPages: 1 })
	.run();
