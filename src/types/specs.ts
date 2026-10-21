/**
 * What to extract, relative to the current node:
 *
 * - `'selector'`: trimmed text of the first match
 * - `'selector@attr'`: attribute of the first match (`'@attr'` reads the node itself)
 * - `''`: text of the node itself
 * - `['selector']` or `['selector@attr']`: values from every match
 * - `['selector', { key: spec }]`: one object per match (the selector takes no `@attr`), each spec resolved
 *   relative to it
 * - `{ key: spec }`: an object, each spec resolved the same way
 */
export type Spec = string | string[] | [string, { [key: string]: Spec }] | { [key: string]: Spec };

/** The value a {@link Spec} resolves to; `undefined` when nothing matched. */
export type Extracted = string | undefined | Extracted[] | { [key: string]: Extracted };
