import type { Osmotic } from './osmotic.js';

// Already-visited URLs are not reported: every link back to a known page would fire
export type SkipReason = 'robots' | 'maxPages' | 'status' | 'contentType';

export interface RunStats {
	pages: number; // Pages fetched and parsed
	robotsSkipped: number; // URLs skipped because robots.txt disallowed them
	rows: Record<string, number>; // CSV path -> rows written
}

// Payload of each event
export interface OsmoticEvents {
	start: { osmotic: Osmotic };
	page: { url: string; requestedUrl: string; status: number; ms: number };
	skip: { url: string; reason: SkipReason; status?: number };
	error: { url: string; error: unknown };
	end: { osmotic: Osmotic; stats: RunStats; error?: unknown };
}

export type OsmoticEvent = keyof OsmoticEvents;
export type Handler<E extends OsmoticEvent> = (payload: OsmoticEvents[E]) => unknown;

// Minimal typed event emitter.
// start and end handlers are awaited in order; page, skip and error handlers are
// fired without waiting, so a slow handler never holds up the crawl.
export class Emitter {
	private readonly handlers: { [E in OsmoticEvent]?: Handler<E>[] } = {};

	on<E extends OsmoticEvent>(event: E, handler: Handler<E>): void {
		const list = (this.handlers[event] ??= []) as Handler<E>[];
		list.push(handler);
	}

	off<E extends OsmoticEvent>(event: E, handler: Handler<E>): void {
		const list = this.handlers[event] as Handler<E>[] | undefined;
		const i = list?.indexOf(handler) ?? -1;
		if (i >= 0) list!.splice(i, 1);
	}

	has(event: OsmoticEvent): boolean {
		return (this.handlers[event]?.length ?? 0) > 0;
	}

	// Fire and forget; a failing handler is logged, never thrown into the crawl
	emit<E extends OsmoticEvent>(event: E, payload: OsmoticEvents[E]): void {
		for (const handler of (this.handlers[event] ?? []) as Handler<E>[]) {
			try {
				Promise.resolve(handler(payload)).catch((err) => logHandlerError(event, err));
			} catch (err) {
				logHandlerError(event, err);
			}
		}
	}

	// Run handlers one at a time and wait for each; errors propagate to the caller
	async emitSerial<E extends OsmoticEvent>(event: E, payload: OsmoticEvents[E]): Promise<void> {
		for (const handler of [...((this.handlers[event] ?? []) as Handler<E>[])]) {
			await handler(payload);
		}
	}

	// Run every handler even if some fail; failures are logged
	async emitSettled<E extends OsmoticEvent>(event: E, payload: OsmoticEvents[E]): Promise<void> {
		for (const handler of [...((this.handlers[event] ?? []) as Handler<E>[])]) {
			try {
				await handler(payload);
			} catch (err) {
				logHandlerError(event, err);
			}
		}
	}
}

function logHandlerError(event: string, err: unknown): void {
	console.error(`osmotic: "${event}" handler failed: ${err instanceof Error ? err.stack : err}`);
}
