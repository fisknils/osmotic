# fix/project-layout

## Prompts

1. The issue-triage agent noted that CLAUDE.md's project structure (`src/core/`, `src/types/`, `src/utils/`) doesn't
   match the flat `src/` in the repository. When the agreed scope for issue #4 placed its new class in
   `src/core/PageTracker.ts`, the maintainer decided to fix the layout first.

   > remove the part about "even though the rest of src is still flat". we will fix that before moving on with issue-4

2. The maintainer looked at node-osmosis, which keeps every command in its own file under `src/commands/`, and asked
   whether that would be possible here. Claude proposed one file per built-in command in `src/commands/`, with the
   class keeping a one-line method per command, a small internal interface for the private parts the commands need,
   a CLAUDE.md update for the new folder, and doing it together with the layout refactor. Claude asked whether to post
   the agreed scope on #4 first and then start this branch.

   > yes

## Interpretation

Move `src/` into the layout CLAUDE.md describes, with no behavior changes:

- `core/`: the `Osmotic` class and the machinery it runs on (event emitter, exporter registry and export targets,
  plugin loading, the fetch chain, robots cache, slot pool, page helpers), class files in PascalCase.
- `types/`: only types, split by concern, all public ones re-exported from the entry points as before.
- `utils/`: pure helpers, one concern per file, named after what they do.
- `commands/`: a new folder with one file per built-in chain command (`get`, `find`, `filter`, `set`, `follow`,
  `recurse`, `tap`, `data`, `export`). Each exports a function that builds the step. The class keeps its methods,
  with their TSDoc and types, as one-line calls to those functions, so the public API and its types are unchanged.
  The commands reach the class's private parts (`visit()`, the step's priority, the export list) through a small
  internal interface rather than the whole class.

CLAUDE.md's project structure gets the `commands/` folder. The README's development table lists the new files.
`test/create-site.ts` stays where it is: it tests the `createSite()` helper, so it belongs in `test/`.

## Type

Other (refactor). No behavior changes.

## Version bump

None. The public API and its types don't change, and `exports` in `package.json` only exposes the entry points, so
the internal paths in `dist/` aren't reachable by users.

## Verification

The existing tests and type tests are the check that nothing changed: `npm test` passes without changing any test,
except the paths that tests use to augment internal modules (`declare module '../src/…'`).
