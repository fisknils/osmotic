# feature/list-of-objects-spec

## Prompts

1. The user pasted a product page with two groups of repeated items (offers and specs) and asked how to capture each
   group separately, since `.find()` only branches once per page.

   > How do I solve a product page that has several sections of groups that I would like to capture separately?
   > [...] .find is useful for branching once on the same page, but how do I solve this case?

2. Claude explained that osmotic can't do this in a single `.set()` and suggested a list-of-objects spec. The user then
   shared osmosis code from Gemini, which nests chains inside `.set()`, and asked whether it was valid osmosis.

   > But gemini is very unreliable and hallucinates WAAY too often, so I don't know if that's even valid osmosis
   > syntax. Is it?

3. Claude confirmed the osmosis syntax was valid. The user asked whether the suggested spec would look like this:

   > Your suggestion would make it look like this, right?
   >
   > ```
   > .set({
   >         'name': 'h1',
   >         'offers': [
   >             '[data-test="OfferListItem"]',
   >             {
   >                 'source': '[data-test="OfferClickoutButton"] span',
   >                 'price': '[data-sentry-component="OfferListItemTopRight"] h4'
   >             }
   >         ]
   >     })
   > ```

4. Claude confirmed the shape, listed the details for the plan, and asked whether to create
   `feature/list-of-objects-spec` and write the plan.

   > do it

5. Claude stopped mid-work after a second session, running in the same checkout, branched off this branch and picked
   up its implementation commit. Claude asked whether to fix the branches or wait for the other session to finish.

   > that was my bad. I had two sessions going at the same time. The other one is done now, so you may continue

## Interpretation

Add a spec form `[selector, { key: spec }]`. It finds every match of `selector` relative to the current node and
resolves the object spec against each match, giving an array of objects. Several such specs in one `.set()` capture
several groups from one page in one row, with no second `.find()` and no second fetch.

## Type

Feature

## Breaking change

No. A two-element array spec currently throws, so no working chain uses this shape. `Spec` keeps accepting `string[]`.

## Version bump

Minor (3.0.0 → 3.1.0)

## Scope

- The new `[selector, { key: spec }]` form in `pick()`, the `Spec` type, the README and the changelog.
- The values in the object can be any spec, including another list of objects.
- Left out: osmosis-style nested chains inside `.set()`, and a branching command. Both are much larger than this change.

## Acceptance criteria

- [x] `[selector, { key: spec }]` returns one object per match, with each spec resolved relative to that match. (test/set.ts)
- [x] Two list specs in one `.set()` capture two groups from one page into one row, fetching the page once. (test/set.ts)
- [x] Values in the object can be any spec form: text, `@attr` (with URL resolution), string arrays and nested lists. (test/set.ts)
- [x] No matches gives `[]`. (test/set.ts)
- [x] An array spec that is neither `[string]` nor `[string, object]` still fails the run, with a message naming both
      forms. (test/set.ts)
- [x] The `Spec` type accepts `[string, { key: spec }]` and still accepts `string[]`, and rejects a field object
      first or more than one field object. (test-d/set.ts)

## Affected public API

- `Spec`: adds `[string, { [key: string]: Spec }]`.
- `.set()`: accepts the new form. `Extracted` already covers arrays of objects.

## Impact on the rest of the codebase

- Checked: `pick()` callers (`.set()` only; `follow()`/`recurse()` use `links()`, which takes a string spec), the `Spec`
  and `Extracted` types, the product pages in `test/helpers/sites/shop.ts` and the tests that read them, README spec
  table, sibling plugins (exporters receive `Data`, which already allowed nested arrays).
- Found: Adding offers to the shop's product pages could change what existing tests extract from them. The offers use
  their own class names and no links, so `.price`, `.tag` and `a@href` selectors are unaffected.

## Decisions

- **`['a', 'b']` is caught at runtime only.** Rejecting it in the type would mean narrowing `string[]` to `[string]`,
  which breaks code that passes a `string[]` variable to `.set()`. That type-level break isn't worth it for a case the
  runtime error already reports. Changed in the criteria before any code was written.

## Verification

- The tests in `test/set.ts` and `test-d/set.ts` were committed before the code. The runtime tests failed against the
  old `pick()`, which threw on every two-element array, and `tsc -p tsconfig.test.json` rejected the new form in the
  type tests. With the change, `npm test` passes (108 tests), and the `@ts-expect-error` lines still compile, so the
  type still rejects those shapes.
- All criteria are covered by automated tests; none was checked by hand only.

## Follow-ups

- `osmotic-plugin-csv`: check how it writes a field that holds an array of objects, and document it or flatten it
  there. This branch doesn't change what exporters receive (nested arrays were already possible), but list specs make
  such rows common.
