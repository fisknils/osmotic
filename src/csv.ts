import { createWriteStream, type WriteStream } from 'node:fs';
import type { Data } from './types.js';

/**
 * Options for `Osmotic.csv()`. The defaults (semicolon, UTF-8 BOM) open correctly
 * in Excel in locales that use a decimal comma.
 */
export interface CsvOptions {
	/**
	 * Column order. Fields missing from it are skipped, with one warning.
	 * @defaultValue the keys of the first row
	 */
	columns?: string[] | null;
	/** @defaultValue `';'` */
	delimiter?: string;
	/**
	 * Start the file with a UTF-8 byte order mark.
	 * @defaultValue `true`
	 */
	bom?: boolean;
}

// CSV file written one row at a time; the file is created on the first row
export class CsvSink {
	readonly path: string;
	private readonly initialColumns: string[] | null;
	private readonly delimiter: string;
	private readonly bom: boolean;

	private stream: WriteStream | null = null;
	private columns: string[] = [];
	private rows = 0;
	private warned = false;

	// Defaults suit Swedish Excel: semicolon delimiter and a UTF-8 BOM
	constructor(path: string, { columns = null, delimiter = ';', bom = true }: CsvOptions = {}) {
		this.path = path;
		this.initialColumns = columns;
		this.delimiter = delimiter;
		this.bom = bom;
	}

	// Forget the previous run so the next row starts a fresh file
	reset(): void {
		this.stream = null;
		this.columns = [];
		this.rows = 0;
		this.warned = false;
	}

	write(data: Data): void {
		if (!this.stream) {
			this.columns = this.initialColumns || Object.keys(data);
			this.stream = createWriteStream(this.path, { encoding: 'utf8' });
			if (this.bom) this.stream.write('﻿');
			this.stream.write(this.line(this.columns));
		}
		if (!this.warned) {
			const extra = Object.keys(data).filter((k) => !this.columns.includes(k));
			if (extra.length) {
				console.warn(`${this.path}: ignoring field(s) not in columns: ${extra.join(', ')}`);
				this.warned = true;
			}
		}
		this.stream.write(this.line(this.columns.map((c) => data[c])));
		this.rows++;
	}

	// Flush and close the file, if one was started
	end(): Promise<void> {
		const stream = this.stream;
		return stream ? new Promise((r) => stream.end(r)) : Promise.resolve();
	}

	get rowCount(): number {
		return this.rows;
	}

	summary(): string {
		return this.stream ? `Wrote ${this.rows} row(s) to ${this.path}` : `No rows for ${this.path}`;
	}

	private line(values: unknown[]): string {
		return (
			values
				.map((v) => {
					if (v == null) return '';
					const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
					return /["\r\n]/.test(s) || s.includes(this.delimiter) ? `"${s.replaceAll('"', '""')}"` : s;
				})
				.join(this.delimiter) + '\r\n'
		);
	}
}
