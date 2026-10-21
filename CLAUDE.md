For every new feature, create a feature branch. Name format: feature/branch-name
For every fix, create a fix branch. Name format: fix/branch-name

Commit messages should be short and informative.
If needed, split up changes (files) into many commits for more valuable commit messages.

Before merging to master:

- The version in package.json must be bumped according to the semantic versioning standards.
- CHANGELOG.md must be updated.
- Read README.md and determine whether an update is necessary.

After merging to master:

- the source branch should be deleted.
- run `npm run build` and `npm publish`

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
