# Contributing

## Pushing back

Agreeing with a request isn't the same as helping. Before acting on one, check three things:

- **Is it a good idea?** Would it hurt osmotic, its users or its maintainability, for example by breaking the API without
  need, making defaults less polite, adding a heavy dependency, or weakening a test or check?
- **Does it solve the problem?** Would it fix the issue it's meant to, or only a symptom, or something else?
- **Is this the right approach?** Or is there a clearly better one: simpler, more reliable, cheaper to maintain, or
  already built in?

If any answer is no, say so before doing the work: what the problem is, why, what you'd do instead, and what that costs.
Keep it short, give a recommendation, and let the maintainer decide. Don't quietly do something other than what was
asked, and don't quietly do what was asked either.

The same goes for problems found during the work: when an approach turns out not to work, or something better shows up,
stop and say so instead of finishing it anyway.

Push back once, clearly. If the maintainer still wants it after hearing the objection, do it as asked, and record the
objection and the decision under Decisions in `PLAN.md` (add the section if the plan doesn't have one).

## Branches

- For every new feature, create a feature branch named `feature/branch-name`.
- For every fix, create a fix branch named `fix/branch-name`.

## Plan

Every branch has a `PLAN.md` in the repository root, written before any code. Keep it up to date while working.

```md
# <Branch name>

## Prompts

Every prompt that shaped this branch, in order. Append new ones as they arrive. A prompt alone often makes no sense
("ok", "yes, do that"), so start each with a short note on what it responds to: the question, suggestion or result it
reacts to, or the state of the work when it came in. Then quote the prompt verbatim. A reader of the plan or the pull
request should understand each prompt without the conversation.

1. Claude explained that authors can't approve their own pull requests, proposed required status checks instead, and
   asked whether to set them up.

   > ok

## Interpretation

What the prompts are understood to ask for, in your own words. Write it before any code, so a misreading is caught early.

## Type

Feature, Bugfix or Other (formatting, documentation, dependency updates and so on).

## Breaking change

Yes or no, and if yes, what breaks and how to migrate.

## Version bump

Major, minor, patch or none, following from the type and whether it breaks.

## Scope

What this branch does, and what it deliberately leaves out.

## Acceptance criteria

- [ ] Checkable statements. Each one is covered by an automated test, or says why it can't be.

## Affected public API

Commands, options, events and types that are added, changed or removed.

## Impact on the rest of the codebase

- Checked: what was searched or reviewed, such as callers of every changed function or type, modules
  importing changed files, the run lifecycle and shared state, examples, docs, and plugins in sibling repos.
- Found: every effect outside the intended change, or "None". "None" only counts with the list above filled in.

## Decisions

Questions that came up while working, and how they were answered.

## Verification

How each acceptance criterion was checked, and anything left unchecked.

## Follow-ups

Work this branch causes elsewhere, such as other repos, publish order, or docs.
```

For changes of type Other, the Prompts, Interpretation, Type and Version bump sections are enough.

## Tests

New features and bugfixes come with automated tests, written before the code:

1. Write tests for the acceptance criteria in `PLAN.md`. A bugfix starts with a test that reproduces the bug.
2. Run them and see them fail. A test that passes before the code exists doesn't test the change.
3. Write the code until the tests pass.

When a test fails against new code, fix the code, not the test. A test may only be changed after the code is written if the test itself is wrong: it has a bug, or it checks something the acceptance criteria don't require. In that case, record in the `Decisions` section of `PLAN.md` what was wrong with the test and why, before changing it. Changing a test to match what the code happens to do is never allowed.

Commit the tests before the code, so the history shows they came first.

### Writing tests

- Use `node:test` and `node:assert/strict`. Tests are TypeScript, run with `tsx`, and import from `src/`. The only exception is `test/package.ts`, which checks the build in `dist/`.
- Serve pages with `createSite()` from `test/helpers/`: it maps paths to pages on a local HTTP server, records every request in `site.requests`, and serves the same site as `site.otherOrigin` under a second hostname for cross-domain tests. Use `openSite(t, pages)`, which closes the site when test `t` ends.
- Prefer the scenario sites in `test/helpers/sites/` (a web shop, a news aggregator, a blog with `<base href>`) over one-off pages, and add pages to them when a test needs a situation real sites have. Keep one-off pages for syntax details, such as a selector edge case.
- Run chains with `scrape()` from `test/helpers/`, which returns the rows and every event of the run.
- Never use `data:` URLs or real websites. Pages behind `data:` URLs can't link to each other and skip the HTTP layer, and real websites make tests slow and flaky.
- Paths without an entry return 404, so a site without `/robots.txt` allows everything. Add a `/robots.txt` page to test robots handling.
- Commands and plugins registered with `Osmotic.command()`, `Osmotic.plugins()` and similar are global and can't be removed, so use names unique to the test file. Each test file runs in its own process.
- Branches run concurrently, so don't assert on the order of rows or requests that run in parallel; sort them first.
- A test that exposes a bug in existing code keeps its assertion as written. Mark it `{ todo: '<reason>' }` so it is reported without failing the run, record the bug in `PLAN.md` under Follow-ups, and fix it on a `fix/` branch that removes the `todo`.

### Skipping tests

A bugfix may skip the automated test only when one isn't practical, such as for packaging or install problems, documentation, or behavior that depends on real sites, timing or the environment. "It takes effort" is not a reason. Type-only fixes are tested in `test-d/`. When skipping, the `Verification` section of `PLAN.md` must say why a test isn't practical, and how the fix was checked instead, as steps someone else can repeat.

## Commits

- Commit messages should be short and informative.
- If needed, split up changes (files) into several commits for more valuable commit messages.

## Pull requests

Changes reach `master` only through pull requests on GitHub. `master` is protected: it needs a pull request, the checks in
`.github/workflows/test.yml` (`npm test` on Node.js 22 and 24, and the Prettier check) must pass on a branch that is up to
date with `master`, and force pushes and deleting the branch are blocked, for admins too. No approval is required, since
GitHub doesn't let authors approve their own pull requests.

1. Push the branch and open a pull request with `gh pr create`. Use the branch's `PLAN.md` as the description, so the plan
   is kept on GitHub after the file is removed.
2. When the branch is ready, go through [Before merging to master](#before-merging-to-master) and push.
3. Wait for the checks with `gh pr checks --watch`. If one fails, fix the cause; never weaken a check to get it green.
4. Merge with `gh pr merge --merge --delete-branch`, which makes the merge commit and deletes the branch on GitHub and
   locally, then `git pull` on `master`.

If `master` moved on meanwhile, rebase the branch onto it and push with `git push --force-with-lease`. Force pushes are
fine on your own branch, never on `master`.

## Before merging to master

- Every acceptance criterion in `PLAN.md` is ticked off, or the plan says why it was dropped.
- `npm test` passes.
- Bump the version in `package.json` according to [semantic versioning](https://semver.org/).
- Update `CHANGELOG.md`.
- Read `README.md` and determine whether an update is necessary.
- Remove `PLAN.md` in a final commit. It stays in the branch's history, which the merge commit keeps reachable.

## After merging to master

- Delete the source branch (`gh pr merge --delete-branch` does this).
- Run `npm publish`. Its `prepublishOnly` script runs `npm run build` first.

## Project structure

Source code goes in `src/`, grouped into folders by role. `src/` holds only the entry points and those folders:

```
src/
  index.cts          CommonJS entry point: assembles and exports the public API
  index.mts          ESM entry point: re-exports the CommonJS build
  core/              the Osmotic class and the machinery it runs on
  commands/          the built-in chain commands, one file per command
  types/             public types, one file per concern
  errors/            custom error classes, one class per file
  utils/             small, self-contained helpers, one concern per file
test/                runtime tests, one file per feature
  helpers/           shared test fixtures, such as the local HTTP test server
test-d/              type-level tests, one file per feature; compiled, never run
dist/                build output (not committed)
```

- `core/`: stateful classes and run logic. A file that defines a class is named after it in PascalCase (`Osmotic.ts`, `SlotPool.ts`, `RobotsCache.ts`); other files are kebab-case (`plugins.ts`, `constants.ts`).
- `commands/`: one kebab-case file per built-in chain command, named after it (`get.ts`, `recurse.ts`, `export.ts`). Each exports a function that builds the command's step. The `Osmotic` class keeps a method per command, with its TSDoc, that calls this function, so the public types stay on the class. Commands reach the class's private parts only through `CommandHost` in `core/command-host.ts`.
- `types/`: only types and interfaces, no runtime code. Split by concern (`options.ts`, `context.ts`, `fetch.ts`, `events.ts`, `exporters.ts`, `plugins.ts`). Everything public is re-exported from the entry points.
- `errors/`: every custom error class gets its own file named after the class (`OsmoticError.ts`). Add the folder with the first one; until then, plain `Error` is fine.
- `utils/`: pure functions that don't import from `core/`, in kebab-case files named after what they do (`delay.ts`, `normalize-selector.ts`, `resolve-url.ts`).
- Code moves into the folder its role matches. A file that mixes roles is split: an event emitter class goes to `core/`, its event payload types to `types/`.
- `test/`: one kebab-case file per feature or behavior (`recurse.ts`, `export.ts`, `robots.ts`, `plugins.ts`), not one file per source file. Shared setup lives in `test/helpers/`, exported through `test/helpers/index.ts`. See [Writing tests](#writing-tests).
- `test-d/`: type tests for the public API, one file per feature, using `@ts-expect-error` for calls that must not compile.

TypeScript config is layered:

- `tsconfig.json`: shared compiler options; includes `src`.
- `tsconfig.dist.json`: extends it for the build (`rootDir: src`, `outDir: dist`, source maps).
- `tsconfig.test.json`: extends it with `noEmit` and includes `test` and `test-d`, so `npm test` type-checks the tests and the type tests.

`npm run build` compiles with `tsconfig.dist.json`. `npm test` builds, type-checks `test/` and `test-d/`, and then runs `test/*.ts`. The `files` field in `package.json` publishes `dist`, and `main`, `types` and `exports` point into it.

When you add a file, put it where this layout says it belongs. Moving existing files into this layout is a refactor of its own, on its own branch, with no behavior changes.

## Documentation comments

Editor tooltips are the documentation most users read, so everything the entry points export has complete TSDoc, and so do the step functions in `src/commands/` and `CommandHost`:

- A summary that says what it does and anything surprising about it, such as what it carries over, what it skips and when it fails.
- `@param` for every parameter, also when the name seems obvious. Put a parameter's default in its `@param` text ("Defaults to `'a@href'`."); `@defaultValue` is for properties.
- `@typeParam` for every type parameter.
- `@returns` when a function returns a value, but not on chainable methods that return `this`.
- `@throws` for every error it throws, and when: while the chain is built, or when the step runs and fails the run.
- `@example` on every public method, and the examples follow the advice of the docs around them (for example, steps return `next()`'s promise rather than awaiting it).
- Interface members and type properties get a one-line summary at least, and `@defaultValue` where they have a default.

Internal code outside `src/commands/` keeps short `//` comments.
