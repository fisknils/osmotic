# Contributing

## Branches

- For every new feature, create a feature branch named `feature/branch-name`.
- For every fix, create a fix branch named `fix/branch-name`.

## Plan

Every branch has a `PLAN.md` in the repository root, written before any code. Keep it up to date while working.

```md
# <Branch name>

## Prompts

Every prompt that shaped this branch, verbatim, in order. Append new ones as they arrive.

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

## Commits

- Commit messages should be short and informative.
- If needed, split up changes (files) into several commits for more valuable commit messages.

## Before merging to master

- Every acceptance criterion in `PLAN.md` is ticked off, or the plan says why it was dropped.
- `npm test` passes.
- Bump the version in `package.json` according to [semantic versioning](https://semver.org/).
- Update `CHANGELOG.md`.
- Read `README.md` and determine whether an update is necessary.
- Remove `PLAN.md` in a final commit. It stays in the branch's history, which the merge commit keeps reachable.

## After merging to master

- Delete the source branch.
- Run `npm run build` and `npm publish`.

## Project structure

Source code goes in `src/`, grouped into folders by role. `src/` holds only the entry points and those folders:

```
src/
  index.cts          CommonJS entry point: assembles and exports the public API
  index.mts          ESM entry point: re-exports the CommonJS build
  core/              the Osmotic class and the machinery it runs on
  types/             public types, one file per concern
  errors/            custom error classes, one class per file
  utils/             small, self-contained helpers, one concern per file
test/                runtime tests, one file per feature
  helpers/           shared test fixtures, such as the local HTTP test server
test-d/              type-level tests, one file per feature; compiled, never run
distribution/        build output (not committed)
```

- `core/`: stateful classes and run logic. A file that defines a class is named after it in PascalCase (`Osmotic.ts`, `SlotPool.ts`, `RobotsCache.ts`); other files are kebab-case (`plugins.ts`, `constants.ts`).
- `types/`: only types and interfaces, no runtime code. Split by concern (`options.ts`, `context.ts`, `fetch.ts`, `events.ts`, `exporters.ts`, `plugins.ts`). Everything public is re-exported from the entry points.
- `errors/`: every custom error class gets its own file named after the class (`OsmoticError.ts`). Add the folder with the first one; until then, plain `Error` is fine.
- `utils/`: pure functions that don't import from `core/`, in kebab-case files named after what they do (`delay.ts`, `normalize-selector.ts`, `resolve-url.ts`).
- Code moves into the folder its role matches. A file that mixes roles is split: an event emitter class goes to `core/`, its event payload types to `types/`.
- `test/`: one kebab-case file per feature or behavior (`recurse.ts`, `export.ts`, `robots.ts`, `plugins.ts`), not one file per source file. Shared setup lives in `test/helpers/`, exported through `test/helpers/index.ts`. Tests use `node:test` and import from `src/`.
- `test-d/`: type tests for the public API, one file per feature, using `@ts-expect-error` for calls that must not compile.

TypeScript config is layered:

- `tsconfig.json`: shared compiler options; includes `src`.
- `tsconfig.dist.json`: extends it for the build (`rootDir: src`, `outDir: distribution`, source maps).
- `tsconfig.test.json`: extends it with `noEmit` and includes `test-d`, so `npm test` type-checks the type tests.

`npm run build` compiles with `tsconfig.dist.json`. `npm test` builds, type-checks `test-d`, and then runs `test/`. The `files` field in `package.json` publishes `distribution`, and `main`, `types` and `exports` point into it.

When you add a file, put it where this layout says it belongs. Moving existing files into this layout is a refactor of its own, on its own branch, with no behavior changes.
