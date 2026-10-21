# feature/test-setup

## Prompts

1. "Now, in order for us to stick to this, we'll need to decide on a testing framework"
2. "Some of the osmotics commands can be tested with simple html snippets and loading it as data: urls, but others (like .recurse or .follow) require multi- page layouts. How do we solve that?"
3. "Sounds like a plan."
4. "I noticed another thing I don't like in CLAUDE.md... making the output dir "distribution/". Keep it as "dist""
5. "Well that's nice, but we'll need to create likely scenarios so we can test all of osmotics commands as well"

## Interpretation

Set up automated testing so the test-first rule in CLAUDE.md can be followed: `node:test` as the framework, `tsx` to run
TypeScript tests against `src/`, a `createSite()` helper that serves a site from a path-to-page map on a local HTTP
server, a packaging test against the build, and an `npm test` script. Write down in CLAUDE.md how tests are written.

Then build realistic scenario sites (a web shop, a news aggregator, a blog with `<base href>`) and test every command,
option and event against them, checking the behavior the README promises. Where a test shows the code breaks that
promise, the test stays as written and the bug is reported.

## Type

Other (development tooling and tests). The CLAUDE.md rules for plans, tests and project structure ride along,
cherry-picked from `feature/export`, which keeps them until it is rebased.

## Breaking change

No. Nothing in the published package changes.

## Version bump

None. Only development files change, so there is nothing to publish.

## Scope

In: the test runner, `tsconfig.test.json`, `createSite()` and its tests, the scenario sites, tests for every command,
option and event, the packaging test, and the testing rules in CLAUDE.md.

Out: fixing bugs the tests find (each gets a `fix/` branch), `.csv()` (removed on `feature/export`), proxies in slots,
the move to the `src/` folder layout, and CI.

## Acceptance criteria

- [x] `npm test` builds, type-checks `test/` and `test-d/`, and runs every `test/*.ts` file with `node:test`.
- [x] `createSite()` serves HTML strings with status 200, and objects with their status, type, headers, body or redirect.
- [x] Paths without an entry, including `/robots.txt`, return 404.
- [x] `site.requests` lists each request's path, host, headers and arrival time, in order.
- [x] A site is reachable as `127.0.0.1` and as `localhost`, two hostnames for cross-domain tests.
- [x] `createSite()` can delay responses, counts concurrent requests, and fills in `{{origin}}` and `{{otherOrigin}}`.
- [x] Scenario sites for a shop, a news aggregator and a blog live in `test/helpers/sites/`.
- [x] Every command has tests: `get`, `find`, `filter`, `set`, `follow`, `recurse`, `tap`, `data`, `use`, `useFetch`,
      `on`, `off`, `command`, `plugins`, `run`, and the `fetchPage()` and `links()` helpers.
- [x] Every option has tests except `slots[].proxy`: `concurrency`, `maxPages`, `delay`, `userAgent`, `headers`, `slots`,
      `respectRobots`, `respectCrawlDelay`, `robotsUserAgent`, `resolveUrls` and `pseudos`.
- [x] Every event has tests, including payloads, ordering, and failing handlers.
- [x] The packaging test shows that `require` and `import` of the build share one `Osmotic` class.
- [x] CLAUDE.md says which framework to use, how to build test sites, and that tests never use `data:` URLs or the
      network.

## Affected public API

None.

## Impact on the rest of the codebase

- Checked: `package.json` scripts and `files` (tests are not published), `tsconfig.json` (the build still includes only
  `src`), `.prettierignore`, the README's Development section, and run time of `npm test` (about 5 seconds, stable
  over four runs).
- Found: the README's Development section lists the npm scripts and needs `npm test`.

## Decisions

- `node:test` rather than Vitest: built in, and the plugin repos already use it.
- `tsx` runs the tests, because Node's own type stripping doesn't map `./osmotic.js` imports to `osmotic.ts`.
- A local HTTP server rather than `data:` URLs, which can't link to other pages, or a fetch middleware, which can't
  serve `robots.txt` or redirects.
- Test fix in `test/follow.ts` ("only http(s) links are followed"): the test sorted the actual URLs but listed the
  expected ones unsorted. The expected list is now sorted too; the URLs in it are unchanged.
- `test/plugins.ts`: osmotic accepts an array as a plugin's `commands`, against the README, and `[fn]` would register a
  command named `"0"`. The assertion is unchanged, moved into its own test marked `todo` until a `fix/` branch fixes the
  code.

## Verification

`npm test` passes: 85 tests, 1 todo (the bug above), and `tsc -p tsconfig.test.json` with the `@ts-expect-error` lines
in `test-d/plugins.ts`. Ran four times without a flaky result; the timing tests (delay, Crawl-delay, concurrency) keep a
margin of at least 10%. Not tested: proxies in slots, which need a proxy server.

## Follow-ups

- `fix/plugin-commands-array`: reject an array as `commands`, and remove `todo` from its test.
- `feature/export`: rebase onto master after this merges, then add tests and a `PLAN.md` for it.
- Proxy support in slots: test with a small proxy in `test/helpers/`.
