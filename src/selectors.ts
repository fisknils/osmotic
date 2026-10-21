import { hasChildren, isText, type AnyNode } from "domhandler";
import type { Pseudos } from "./types.js";

// --- Text pseudo-selectors --------------------------------------------------

// Raw text of a node and all its descendants
const rawText = (el: AnyNode): string =>
  isText(el) ? el.data : hasChildren(el) ? el.children.map(rawText).join("") : "";

// Strip surrounding quotes if the selector engine left them in
const unquote = (v: string | null | undefined): string =>
  String(v ?? "").replace(/^(['"])(.*)\1$/, "$2");

export const builtinPseudos: Pseudos = {
  // Exact trimmed text: span:text-is("Sockel")
  // (Not ":text", which css-select reserves for jQuery's input[type=text])
  "text-is": (el, value) => rawText(el).trim() === unquote(value),
  // Regex on trimmed text: span:text-match("^[0-9]+ W$")  (use [0-9], not \d)
  "text-match": (el, value) => new RegExp(unquote(value)).test(rawText(el).trim()),
};

// --- Selector syntax --------------------------------------------------------

// Translate XPath-style indexes outside quotes: "span[4]" -> "span:nth-of-type(4)"
export function normalizeSelector(sel: string): string {
  return sel
    .split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)
    .map((part, i) => (i % 2 ? part : part.replace(/\[(\d+)\]/g, ":nth-of-type($1)")))
    .join("");
}

// Split "selector@attr" at a trailing @attr; an "@" inside the selector is left alone
export function splitSpec(spec: string): [selector: string, attr: string | undefined] {
  const m = spec.match(/^([\s\S]*)@([A-Za-z_:][\w:.-]*)$/);
  return m ? [normalizeSelector(m[1]), m[2]] : [normalizeSelector(spec), undefined];
}
