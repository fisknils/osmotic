import type { SitePage } from '../create-site.js';

// A link aggregator in the style of Hacker News: stories in table rows, three per
// page over three pages joined by "More" links, each pointing to a discussion page
// on the site or to an article on another host.

interface Story {
	id: number;
	title: string;
	/** Path of the linked article; on the other host when `external`. */
	path: string;
	external: boolean;
}

export const stories: Story[] = Array.from({ length: 9 }, (_, i) => ({
	id: i + 1,
	title: `Story ${i + 1}`,
	path: i % 3 === 2 ? `/article/${i + 1}` : `/item?id=${i + 1}`,
	external: i % 3 === 2,
}));

const href = (s: Story) => (s.external ? `{{otherOrigin}}${s.path}` : s.path);

const listing = (page: number) => {
	const rows = stories
		.slice((page - 1) * 3, page * 3)
		.map(
			(s) => `
		<tr class="athing" id="${s.id}">
			<td class="rank">${s.id}.</td>
			<td><span class="titleline"><a href="${href(s)}">${s.title}</a></span></td>
		</tr>
		<tr><td class="subtext"><a href="/item?id=${s.id}">${s.id * 10} comments</a></td></tr>`,
		)
		.join('');
	const more = page < 3 ? `<a class="morelink" rel="next" href="?p=${page + 1}">More</a>` : '';
	return `<!doctype html><html><body><table>${rows}</table>${more}</body></html>`;
};

export const news: Record<string, SitePage> = {
	'/': listing(1),
	'/?p=2': listing(2),
	'/?p=3': listing(3),
	...Object.fromEntries(
		stories.map((s) => [
			`/item?id=${s.id}`,
			`<!doctype html><html><head><title>${s.title} | News</title></head><body><h1>${s.title}</h1></body></html>`,
		]),
	),
	...Object.fromEntries(
		stories
			.filter((s) => s.external)
			.map((s) => [s.path, `<!doctype html><html><head><title>${s.title}</title></head><body></body></html>`]),
	),
};
