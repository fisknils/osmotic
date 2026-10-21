import type { Handler, OsmoticEvent, OsmoticEvents } from '../types/events.js';

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
