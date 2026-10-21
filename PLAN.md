# fix/list-spec-selector

## Prompts

1. The pr-review agent reviewed PR #10 (list specs `["selector", { key: spec }]`), which had been merged before review
   but not published. It found that the list's own selector skips `normalizeSelector()`, so XPath-style indexes such as
   `tr[2]` give `[]`, and that an `@attr` on the list selector is silently ignored. Claude asked whether to post the
   review, whether `@attr` should throw or be documented as unsupported, and whether to fold the fix into the
   unpublished 3.1.0 instead of bumping.

   > skip posting a review on #10. throw on @attr fold fix into the 3.1.0 changelog entry without bumping

## Interpretation

In a list spec `["selector", { key: spec }]`, the selector goes through the same selector extras as every other
selector, so `[n]` indexes work. An `@attr` on it fails the run with a clear error instead of giving `[]`. The review on
#10 is not posted. The 3.1.0 changelog entry describes the fixed behavior, and the version stays at 3.1.0, since 3.1.0
was never published.

## Type

Bugfix

## Breaking change

No. The fixed behavior hasn't been published.

## Version bump

None. 3.1.0 is unpublished; the fix is folded into it.

## Scope

- `pick()` in `src/extract.ts`, tests in `test/set.ts`, the 3.1.0 entry in `CHANGELOG.md`, and the list spec note in
  `README.md`.
- Left out: posting the review on #10.

## Acceptance criteria

- [x] An XPath-style index on a list selector works: `['.specs tr[2]', { label: 'td[1]' }]` gives
      `[{ label: 'Colour' }]`. (test/set.ts)
- [x] A list selector with `@attr` fails the run with an error that says the list selector takes no attribute.
      (test/set.ts)

## Affected public API

- `.set()`: list specs now accept the selector extras on their selector, and reject `@attr` on it. Both only affect the
  unpublished 3.1.0.

## Impact on the rest of the codebase

- Checked: `pick()` callers (`.set()` only), `splitSpec()` and `normalizeSelector()` in `src/selectors.ts` and their
  other callers (unchanged), the README's spec table and "Selector extras" section.
- Found: None.

## Decisions

- **No version bump**, although "Before merging" asks for one: 3.1.0 was never published, so no released version has
  the bug. The maintainer chose to fold the fix into 3.1.0.
- **The review on #10 is not posted**, at the maintainer's request.
- The review's nit, that #10 changed an existing assertion without a note: #10's plan is already in history, so it is
  recorded here instead. The assertion moved to the new message because an acceptance criterion of #10 required it,
  and it was changed in the tests commit, before the code.

## Verification

- The two tests in `test/set.ts` were committed before the fix and failed against it: the index case gave `[]`, and
  the `@attr` case didn't throw. With the fix, `npm test` passes (110 tests) and the Prettier check is clean.

## Follow-ups
