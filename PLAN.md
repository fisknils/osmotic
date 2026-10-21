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

3. Sent while Claude was moving the files: the class's command methods had become one-line calls.

   > can we use arrow- functions in Osmotic.ts for the one- line methods?

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

## Decisions

- Prompt 3, open: Claude recommended keeping the command methods as methods, not arrow-function properties. Arrow
  properties live on each instance,
  not on the prototype, and `Osmotic.command()` and `Osmotic.plugins()` detect taken names with
  `name in Osmotic.prototype`. A plugin could then register `get` without an error, and the instance property would
  silently shadow it. Arrow properties also can't be overridden or reached through `super` in a subclass.
- `links()` in the old `extract.ts` is now `collectLinks()` in `utils/collect-links.ts`, named after its file and no
  longer sharing a name with `Osmotic#links()`.
- `test/create-site.ts` stays: it holds the tests for the `createSite()` helper, one file per feature as CLAUDE.md
  asks, not a misplaced helper.

## Verification

- `npm test` passes, 115 tests, with no test changed except the paths that tests use to augment internal modules
  (`declare module '../src/…'`) and a comment in `test/memory.ts` naming the file of `detach()`. This includes the
  type tests, the memory tests and `test/package.ts`, which loads both entry points from `dist/`.
- `src/index.cts` exports the same 29 names as on `master`.
- The plugins augment `declare module 'osmotic'`, not internal paths, and `exports` in `package.json` only exposes the
  entry points, so no plugin can reach the moved files. Checked by searching the sibling plugin repositories.
- The examples still parse (`node -c examples/*.js`).
