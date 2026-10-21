import { hasChildren, isText, type AnyNode } from 'domhandler';
import type { Pseudos } from '../types/options.js';

// Raw text of a node and all its descendants
const rawText = (el: AnyNode): string =>
	isText(el) ? el.data : hasChildren(el) ? el.children.map(rawText).join('') : '';

// Strip surrounding quotes if the selector engine left them in
const unquote = (v: string | null | undefined): string => String(v ?? '').replace(/^(['"])(.*)\1$/, '$2');

// The text pseudo-classes osmotic adds to every page
export const builtinPseudos: Pseudos = {
	// Exact trimmed text: span:text-is("Sockel")
	// (Not ":text", which css-select reserves for jQuery's input[type=text])
	'text-is': (el, value) => rawText(el).trim() === unquote(value),
	// Regex on trimmed text: span:text-match("^[0-9]+ W$")  (use [0-9], not \d)
	'text-match': (el, value) => new RegExp(unquote(value)).test(rawText(el).trim()),
};
