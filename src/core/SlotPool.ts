import type { Slot } from '../types/options.js';

interface Waiter {
	id: number | undefined; // The slot it waits for, or undefined for any
	wake: (slot: Slot) => void;
}

// Fixed set of request slots. Waiters with a higher priority are served first,
// equal priorities first come, first served. A waiter may wait for one slot in particular.
export class SlotPool {
	private readonly free: Slot[];
	private readonly ids: Set<number>;
	private readonly waiting = new Map<number, Waiter[]>(); // priority -> FIFO

	constructor(slots: Slot[]) {
		this.free = [...slots];
		this.ids = new Set(slots.map((s) => s.id));
	}

	// Take a free slot, or the slot with this id, or wait until release() hands it over
	acquire(priority = 0, id?: number): Promise<Slot> {
		if (id !== undefined && !this.ids.has(id)) return Promise.reject(new Error(`This run has no slot with id ${id}`));
		const i = id === undefined ? (this.free.length ? 0 : -1) : this.free.findIndex((s) => s.id === id);
		if (i >= 0) return Promise.resolve(this.free.splice(i, 1)[0]);
		return new Promise((wake) => {
			const queue = this.waiting.get(priority);
			if (queue) queue.push({ id, wake });
			else this.waiting.set(priority, [{ id, wake }]);
		});
	}

	// Pass the slot directly to the highest-priority waiter that takes it, or put it back if none does
	release(slot: Slot): void {
		const wake = this.nextWaiter(slot);
		if (wake) wake(slot);
		else this.free.push(slot);
	}

	private nextWaiter(slot: Slot): ((slot: Slot) => void) | undefined {
		if (!this.waiting.size) return undefined;
		for (const priority of [...this.waiting.keys()].sort((a, b) => b - a)) {
			const queue = this.waiting.get(priority)!;
			const i = queue.findIndex((w) => w.id === undefined || w.id === slot.id);
			if (i < 0) continue;
			const [{ wake }] = queue.splice(i, 1);
			if (!queue.length) this.waiting.delete(priority);
			return wake;
		}
		return undefined;
	}
}
