import type { Slot } from './types.js';

// Fixed set of request slots. Waiters with a higher priority are served first,
// equal priorities first come, first served.
export class SlotPool {
	private readonly free: Slot[];
	private readonly waiting = new Map<number, ((slot: Slot) => void)[]>(); // priority -> FIFO

	constructor(slots: Slot[]) {
		this.free = [...slots];
	}

	// Take a free slot, or wait until release() hands one over
	acquire(priority = 0): Promise<Slot> {
		const slot = this.free.shift();
		if (slot) return Promise.resolve(slot);
		return new Promise((r) => {
			const queue = this.waiting.get(priority);
			if (queue) queue.push(r);
			else this.waiting.set(priority, [r]);
		});
	}

	// Pass the slot directly to the highest-priority waiter, or put it back if nobody waits
	release(slot: Slot): void {
		const wake = this.nextWaiter();
		if (wake) wake(slot);
		else this.free.push(slot);
	}

	private nextWaiter(): ((slot: Slot) => void) | undefined {
		if (!this.waiting.size) return undefined;
		const top = Math.max(...this.waiting.keys());
		const queue = this.waiting.get(top)!;
		const wake = queue.shift();
		if (!queue.length) this.waiting.delete(top);
		return wake;
	}
}
