import type { Data } from '../types/context.js';
import type { Exporter } from '../types/exporters.js';

// One .export() step: creates its exporter on the first row of each run and counts rows
export class ExportTarget {
	private exporter: Exporter | null = null;
	private rows = 0;

	constructor(
		readonly file: string,
		private readonly create: () => Exporter,
	) {}

	// Forget the previous run so the next row starts a fresh exporter
	reset(): void {
		this.exporter = null;
		this.rows = 0;
	}

	write(data: Data): unknown {
		this.exporter ??= this.create();
		const result = this.exporter.write(data);
		this.rows++;
		return result;
	}

	async end(): Promise<void> {
		if (this.exporter) await this.exporter.end();
	}

	get rowCount(): number {
		return this.rows;
	}

	summary(): string {
		return this.exporter ? `Wrote ${this.rows} row(s) to ${this.file}` : `No rows for ${this.file}`;
	}
}
