import type { Step } from '../../src/index.cjs';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

let runGc: (() => void) | undefined;

/**
 * Run a full garbage collection. Objects reached through a `WeakRef` in the current
 * job stay alive until it ends, so this waits for the next macrotask first.
 */
export async function collectGarbage(): Promise<void> {
	await new Promise((resolve) => setImmediate(resolve));
	// Expose V8's gc() without the --expose-gc flag, on first use, so only the
	// processes of test files that collect garbage get the flag
	if (!runGc) {
		setFlagsFromString('--expose-gc');
		runGc = runInNewContext('gc') as () => void;
	}
	runGc();
}

/** Heap in use after a full garbage collection, in bytes. */
export async function heapUsed(): Promise<number> {
	await collectGarbage();
	return process.memoryUsage().heapUsed;
}

/** Records objects, such as page DOMs, without keeping them alive, to count how many still are. */
export class LiveSet<T extends object> {
	private readonly refs: { label: string; ref: WeakRef<T> }[] = [];

	add(label: string, value: T): void {
		this.refs.push({ label, ref: new WeakRef(value) });
	}

	/** Labels of the recorded objects that survive a full garbage collection. */
	async alive(): Promise<string[]> {
		await collectGarbage();
		return this.refs.filter((r) => r.ref.deref() !== undefined).map((r) => r.label);
	}
}

/**
 * The most heap a run kept alive: the peak heap in use, sampled after a full garbage
 * collection each time `sample` runs, minus the heap just before the run. Memory that is
 * never released counts too, since it is still in use at the peak.
 *
 * @param run - Runs the chain, calling `sample` as a step at the points to measure.
 */
export async function peakHeap(run: (sample: Step) => Promise<void>): Promise<number> {
	const before = await heapUsed();
	let peak = before;
	await run(async (ctx, next) => {
		peak = Math.max(peak, await heapUsed());
		return next(ctx);
	});
	return peak - before;
}
