import robotsParser from 'robots-parser';
import { sleep } from './util.js';

type Robots = ReturnType<typeof robotsParser>;

// robots.txt rules and Crawl-delay scheduling for one run
export class RobotsCache {
	private readonly robots = new Map<string, Promise<Robots>>();
	private readonly crawlNext = new Map<string, number>(); // origin -> earliest next request

	constructor(private readonly userAgent: string) {}

	async allows(url: string): Promise<boolean> {
		const robots = await this.robotsFor(url);
		return robots.isAllowed(url, this.userAgent) !== false;
	}

	// Space requests to the same site by its Crawl-delay, across all slots
	async waitCrawlDelay(url: string): Promise<void> {
		const robots = await this.robotsFor(url);
		const seconds = robots.getCrawlDelay(this.userAgent);
		if (!seconds) return;
		const origin = new URL(url).origin;
		const now = Date.now();
		const start = Math.max(now, this.crawlNext.get(origin) ?? 0);
		this.crawlNext.set(origin, start + seconds * 1000); // Reserve the next time slot
		if (start > now) await sleep(start - now);
	}

	// One robots.txt fetch per origin, shared by all concurrent callers
	private robotsFor(url: string): Promise<Robots> {
		const origin = new URL(url).origin;
		let robots = this.robots.get(origin);
		if (!robots) {
			robots = this.load(`${origin}/robots.txt`);
			this.robots.set(origin, robots);
		}
		return robots;
	}

	private async load(robotsUrl: string): Promise<Robots> {
		let text = '';
		try {
			const res = await fetch(robotsUrl, {
				headers: { 'User-Agent': this.userAgent },
				signal: AbortSignal.timeout(10000),
			});
			if (res.ok) text = await res.text();
		} catch {
			// Unreachable robots.txt is treated as allow-all
		}
		return robotsParser(robotsUrl, text);
	}
}
