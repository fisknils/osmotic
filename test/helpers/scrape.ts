import type { Data, Osmotic, OsmoticEvents } from '../../src/index.cjs';

/** What {@link scrape} collected from a run. */
export interface Scraped {
	/** The data of every branch that reached the end of the chain, in arrival order. */
	rows: Data[];
	page: OsmoticEvents['page'][];
	skip: OsmoticEvents['skip'][];
	error: OsmoticEvents['error'][];
	end: OsmoticEvents['end'] | null;
}

/** Run `chain` and collect its rows and events. */
export async function scrape(chain: Osmotic): Promise<Scraped> {
	const out: Scraped = { rows: [], page: [], skip: [], error: [], end: null };
	chain
		.on('page', (e) => out.page.push(e))
		.on('skip', (e) => out.skip.push(e))
		.on('error', (e) => out.error.push(e))
		.on('end', (e) => (out.end = e))
		.data((d) => out.rows.push(d));
	await chain.run();
	return out;
}

/** `rows` sorted by the string value of `key`, for rows from parallel branches. */
export const sortBy = <T extends Data>(rows: T[], key: string): T[] =>
	[...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
