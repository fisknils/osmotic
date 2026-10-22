# fix/tsconfig-layout

## Prompts

1. Claude noticed that CLAUDE.md describes a `tsconfig.dist.json` that doesn't exist, and the maintainer asked what
   the practical difference between it and `tsconfig.json` is.

   > What's the practical difference between tsconfig.json and tsconfig.dist.json?

2. Claude explained that here the build settings live in `tsconfig.json`, so the difference is consistency with the
   plugins and the editor: editors only read files named `tsconfig.json`, which includes only `src`, so files in
   `test/` and `test-d/` open without a project and outside `strict`. Claude described the usual layout (an editor-facing
   `tsconfig.json` covering every file with `noEmit`, and a build-only `tsconfig.dist.json`).

   > Apply best practices

## Interpretation

- `tsconfig.json` covers `src`, `test` and `test-d` with `noEmit` and the shared compiler options, so the editor checks
  every file with the same options `npm test` uses.
- `tsconfig.dist.json` extends it for the build: only `src`, emitting to `dist` with declarations and source maps.
- `tsconfig.test.json` goes away; `npm test` type-checks with `tsconfig.json`.
- CLAUDE.md's TypeScript section describes the new layout.

The four plugin repositories are left for their own branches.

## Type

Other (build configuration).

## Version bump

None. The published files are byte for byte the same.

## Verification

- Before the change, `tsc -p tsconfig.json --listFilesOnly` listed no file from `test/` or `test-d/`; after it, 29.
- `dist/` built with `tsconfig.dist.json` is identical to the build from `master` (`diff -r`, 117 files).
- `npm test` passes, 119 tests. A type error added to a test file on purpose fails `tsc`, so the tests are still
  type-checked.
