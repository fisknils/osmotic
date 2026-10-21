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

4. Claude recommended keeping them as methods and opened the pull request. The maintainer then looked at the TSDoc on
   the class, where only a few methods had `@param`, `@throws` or `@example`.

   > I'm noticing that you're only documenting a handful of methods fully. Is that really best practice?

5. Claude agreed it isn't, proposed a standard with `@param` for parameters whose meaning isn't obvious, and suggested
   a separate branch after this one.

   > Maybe add @param for each parameter period?

6. Claude agreed, added `@typeParam` for type parameters, and asked whether to merge this branch first.

   > No, add full TSDoc right away

7. The pr-review agent found one blocking problem (the new `host` field hid a plugin command named `host`) and
   ten TSDoc statements, tags and links that didn't match the code. Claude recommended posting the review, fixing
   everything on this branch with `#host`, settling prompt 3 as methods, opening an issue for the older fields with
   the same problem, and reviewing again before merging.

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

On the same branch (prompts 4 to 6), complete TSDoc for everything the entry points export, the step functions in
`src/commands/` and `CommandHost`: a summary, `@param` for every parameter, `@typeParam` for every type parameter,
`@returns` where a value is returned (not on chainable methods), `@throws`, and an `@example` on every public method.
CLAUDE.md gets a "Documentation comments" section with this standard, and the pr-review agent checks that TSDoc is
complete, not only accurate.

## Type

Other (refactor). No behavior changes.

## Version bump

None. The public API and its types don't change, and `exports` in `package.json` only exposes the entry points, so
the internal paths in `dist/` aren't reachable by users.

## Decisions

- Prompt 3, settled in prompt 7: the command methods stay methods, not arrow-function properties. Arrow properties
  live on each instance, not on the prototype, and `Osmotic.command()` and `Osmotic.plugins()` detect taken names with
  `name in Osmotic.prototype`. A plugin could then register `get` without an error, and the instance property would
  silently shadow it. Arrow properties also can't be overridden or reached through `super` in a subclass. The review
  agreed.
- The review found the same problem in this branch's own `host` field, which made a plugin command named `host`
  register but fail when called, while it works on `master`. `host` is now an ES private field (`#host`), which isn't
  a property, with a regression test in `test/extend.ts` that failed before the fix. The older fields with the same
  problem on `master` (`opts`, `steps`, `exports` and others) are issue #16, to fix on its own `fix/` branch, since
  that changes behavior.
- `links()` in the old `extract.ts` is now `collectLinks()` in `utils/collect-links.ts`, named after its file and no
  longer sharing a name with `Osmotic#links()`.
- `test/create-site.ts` stays: it holds the tests for the `createSite()` helper, one file per feature as CLAUDE.md
  asks, not a misplaced helper.

## Verification

- `npm test` passes, 116 tests: the 115 from `master`, unchanged except the paths that tests use to augment internal
  modules (`declare module '../src/…'`) and a comment in `test/memory.ts` naming the file of `detach()`, plus the
  regression test for a command named `host`. This includes the
  type tests, the memory tests and `test/package.ts`, which loads both entry points from `dist/`.
- `src/index.cts` exports the same 29 names as on `master`.
- The plugins augment `declare module 'osmotic'`, not internal paths, and `exports` in `package.json` only exposes the
  entry points, so no plugin can reach the moved files. Checked by searching the sibling plugin repositories.
- The examples still parse (`node -c examples/*.js`).
- A script checked that every parameter of every public `Osmotic` method and every command step function has a
  `@param`, every type parameter a `@typeParam`, and every public method an `@example`. Every exported type and
  interface member has a doc comment. The examples were checked by hand against the advice around them; they aren't
  compiled.
