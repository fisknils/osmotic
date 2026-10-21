# feature/test-setup

## Prompts

1. "Now, in order for us to stick to this, we'll need to decide on a testing framework"
2. "Some of the osmotics commands can be tested with simple html snippets and loading it as data: urls, but others (like .recurse or .follow) require multi- page layouts. How do we solve that?"
3. "Sounds like a plan."

## Interpretation

Set up automated testing so the test-first rule in CLAUDE.md can be followed: `node:test` as the framework, `tsx` to run
TypeScript tests against `src/`, a `createSite()` helper that serves a site from a path-to-page map on a local HTTP
server, a packaging test against the build, and an `npm test` script. Write down in CLAUDE.md how tests are written.

## Type

Other (development tooling). The CLAUDE.md rules for plans, tests and project structure ride along, cherry-picked from
`feature/export`, which keeps them until it is rebased.

## Breaking change

No. Nothing in the published package changes.

## Version bump

None. Only development files change, so there is nothing to publish.

## Scope

In: the test runner, `tsconfig.test.json`, `createSite()`, tests for `createSite()` itself, the packaging test, and the
testing rules in CLAUDE.md.

Out: tests for the existing commands, the move to the `src/` folder layout, and CI.

## Acceptance criteria

- [x] `npm test` builds, type-checks `test/` and `test-d/`, and runs every `test/*.ts` file with `node:test`.
- [x] `createSite()` serves HTML strings with status 200, and objects with their status, type, headers, body or redirect.
- [x] Paths without an entry, including `/robots.txt`, return 404.
- [x] `site.requests` lists each request's path and headers, in order.
- [x] A site is reachable as `127.0.0.1` and as `localhost`, two hostnames for cross-domain tests.
- [x] The packaging test shows that `require` and `import` of the build share one `Osmotic` class.
- [x] CLAUDE.md says which framework to use, how to build test sites, and that tests never use `data:` URLs or the
      network.

## Affected public API

None.

## Impact on the rest of the codebase

- Checked: `package.json` scripts and `files` (tests are not published), `tsconfig.json` (the build still includes only
  `src`), `.prettierignore`, and the README's Development section.
- Found: the README's Development section lists the npm scripts and needs `npm test`.

## Decisions

- `node:test` rather than Vitest: built in, and the plugin repos already use it.
- `tsx` runs the tests, because Node's own type stripping doesn't map `./osmotic.js` imports to `osmotic.ts`.
- A local HTTP server rather than `data:` URLs, which can't link to other pages, or a fetch middleware, which can't
  serve `robots.txt` or redirects.

## Verification

`npm test` passes: 8 tests, and `tsc -p tsconfig.test.json` with the `@ts-expect-error` lines in `test-d/plugins.ts`.
`test/create-site.ts` covers the first five criteria, `test/package.ts` the packaging one. The rules in CLAUDE.md were
checked by reading them.

## Follow-ups

- `feature/export`: rebase onto master after this merges, then add tests and a `PLAN.md` for it.
- Write tests for the existing commands.
