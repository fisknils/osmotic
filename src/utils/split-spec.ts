import { normalizeSelector } from './normalize-selector.js';

// Split "selector@attr" at a trailing @attr; an "@" inside the selector is left alone
export function splitSpec(spec: string): [selector: string, attr: string | undefined] {
	const m = spec.match(/^([\s\S]*)@([A-Za-z_:][\w:.-]*)$/);
	return m ? [normalizeSelector(m[1]), m[2]] : [normalizeSelector(spec), undefined];
}
