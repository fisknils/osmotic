# feature/page-release

## Prompts

1. The issue-triage agent posted the scope agreed for issue #4 ("Let plugins keep state on a loaded page and re-parse
   its HTML"), with additions, a release rule and acceptance criteria, after the osmotic and osmotic-plugin-playwright
   sessions had settled the open questions in the thread.

   > It's time to sort out issue 4.
   >
   > Create the implementation in a new feature branch, then push it, open a PR and launch the review agent

## Interpretation

Build exactly the scope of the last triage comment on issue #4:

- `req.attach(key, value)` and `req.onRelease(fn)` on `FetchRequest`, as closures, optional in the type. Values land in
  a frozen `ctx.attached` on the page the request loads. Calling either after the middleware chain has returned throws.
- A page is released, and its `onRelease` callbacks run, once no step is still working on it. Only pages that called
  `onRelease()` are tracked; every other page takes today's code path.
- `osmotic.loadPage(html, url)` parses HTML the way fetched pages are parsed.
- `osmotic.inSlot(fn, options)` runs `fn` inside a request slot with the same delays as a page load.

The playwright commands themselves are not part of this branch.

## Type

Feature

## Breaking change

No. Everything is an addition. `FetchRequest.attach` and `FetchRequest.onRelease` are optional, so code that builds a
`FetchRequest` itself still compiles. Pages from `fetchPage()` gain an `attached` key, and `withoutPage()` drops it.

## Version bump

Minor: 3.1.1 → 3.2.0.

## Scope

In:

- `FetchRequest.attach` / `FetchRequest.onRelease`, `Page.attached` (and so `Context.attached`).
- Release tracking (rule (b) from the issue), opt-in per page.
- Pages that are skipped or fail are released right away; pages from the public `fetchPage()` when the run ends.
- All release callbacks settle before exporters close and `end` handlers run, also when the run fails. A callback that
  throws or rejects is logged and doesn't fail the run.
- `loadPage()`, `inSlot()` and the `InSlotOptions` type.
- `SlotPool` learns to wait for one particular slot.
- README, CHANGELOG, TSDoc.

Left out (as agreed in the issue): the commands themselves, a release event, `robots.txt` checks for requests a page
makes after loading, a limit on open pages tied to `concurrency`, a way for custom steps to let go of a page before they
settle, and release tracking for pages that custom commands load with `fetchPage()`.

## Acceptance criteria

- [x] Chains that never call `onRelease()` behave exactly as before, and the existing tests, including `test/memory.ts`,
      pass unchanged.
- [x] No measurable slowdown without plugins. Checked by timing the same chain on `master` and on the branch, since a
      timing test would be flaky.
- [x] A `recurse()` crawl over 30 archive pages, with a middleware that calls `onRelease()` for every page and a custom
      async step after `recurse()`, never has more than 2 pages unreleased at once, and has none left when `run()`
      resolves.
- [x] A page is never released while a branch from `find()`, an async `filter()`, `data()` or `export()`, or a pending
      custom step is still on it. It is released once the last one has finished or left it.
- [x] With `follow()` directly after loading, a listing page is released before its linked pages finish.
- [x] Skipped and failed pages are released right away. Pages from `fetchPage()` carry `attached` and are released only
      when the run ends.
- [x] Repeated `next(req)` calls: `attach()` overwrites, and every callback runs exactly once. Both closures work
      through `next({ ...req, url })`, and calling them late throws.
- [x] A callback that throws or rejects is logged, the run still resolves with its rows, and the other callbacks still
      run.
- [x] Every callback has settled before `end` handlers run, also when a step throws.
- [x] Values never reach the next page through `get()`, `follow()`, `recurse()` or a spread `fetchPage()` result.
- [x] `loadPage()` supports `:contains()`, `opts.pseudos` and `<base href>`. It emits no `page` event, leaves `maxPages`
      and `stats.pages` alone, and works outside `run()`.
- [x] `inSlot()` follows `concurrency`, `delay`, a slot's `delay` and `Crawl-delay`. It waits for the given slot, goes
      ahead of waiting page loads by default, frees the slot when `fn` throws, and throws outside `run()`.
- [x] Type tests in `test-d/` cover the new members and signatures, and a `FetchRequest` object written without `attach`
      and `onRelease` still compiles.

## Affected public API

- `FetchRequest.attach?: (key: string, value: unknown) => void` (added)
- `FetchRequest.onRelease?: (fn: () => unknown) => void` (added)
- `Page.attached?: Readonly<Record<string, unknown>>`, and through `Partial<Page>` also `Context.attached` (added)
- `Osmotic.loadPage(html: string, url: string): Page` (added)
- `Osmotic.inSlot<T>(fn: (slot: Slot) => T | PromiseLike<T>, options?: InSlotOptions): Promise<T>` (added)
- `InSlotOptions` type (added)
- `Osmotic.fetchPage()`: its pages now carry `attached` (changed, additive)

## Impact on the rest of the codebase

- Checked:
  - Callers of `fetchPage()`, `visit()`, `slotFetch()`, `withoutPage()` and `SlotPool.acquire/release` in `src/`.
  - Every built-in step in `src/commands/`, for when it calls `next()` and so when it lets go of a page.
  - The run lifecycle in `run()`: start handlers, branches, exporters closing, `end` handlers, and a run that fails while
    other branches are still running.
  - `test/memory.ts`, for anything new that could keep a page's DOM alive (closures capturing `ctx`).
  - `FetchRequest` users in the sibling repos osmotic-plugin-playwright and osmotic-plugin-awswaf-solver: both spread
    `req` into `next()`, which keeps the closures.
  - README sections on custom steps, fetch middleware, commands and plugins; `examples/`.
- Found: None.

## Decisions

- **How built-in steps let go of a page.** The rule "a built-in step lets go as soon as it has passed the page on"
  depends on when each step calls `next()`. Two kinds, marked where the steps are built:

  - lets go when it returns: `find()`, `set()`, `tap()`, `get()`, `follow()` and `recurse()`, which call `next()`
    synchronously for every branch, or pass on only the data.
  - lets go at its first `next()` call, or when its promise settles if it never calls it: `filter()`, `data()` and
    `export()`, which may wait for a function before continuing.

  Any other step holds the page until its promise settles, as agreed.

- **Where the tracker lives.** Release state is keyed by the page's frozen `attached` object in a `WeakMap`, so spreading
  a `loadPage()` result keeps it, `withoutPage()` and a spread `fetchPage()` result drop it, and nothing holds a page's
  DOM. A run that never calls `onRelease()` only checks one boolean per step.
- **Branches still running after a failed run.** When a step fails, `run()` doesn't wait for the other branches (as
  before). A page those branches load after the release callbacks have settled is released as soon as it's loaded,
  so nothing leaks, but its callbacks run after `run()` has rejected. Waiting for those branches would change how
  failed runs end, which is out of scope.
- **Tests that were wrong** (found when the code first ran against them, fixed before any further code change):
  - `a recurse() crawl keeps at most two pages unreleased`: its custom step slept 20 ms while the local pages load in
    about 1.5 ms, so about 14 pages really were still being worked on. No release rule can keep that at 2 without
    releasing a page a step is still on, which another criterion forbids. The test now serves each page with a 15 ms
    delay and sleeps 5 ms in the step, so the next page always loads after the step on the previous one finished, as
    the criterion assumes.
  - `loadPage() parses HTML with the built-in pseudo-classes`: its `<td>` cells weren't inside a `<table>`, so the HTML
    parser dropped them. They are now.
  - `inSlot() waits for the slot it is given`: it assumed that the slot a page load frees goes back to the front of the
    free list, so the next `inSlot()` would get slot 0. It goes to the back, and the criteria don't say which free slot
    comes first. The test now waits for whichever slot the busy call took.
  - The exporter in `test/release.ts` declared its `options` as always present, but an `ExporterFactory` gets
    `options | undefined`, so the file didn't compile.

## Verification

`npm test` passes: 144 tests, including the 25 new ones in `test/release.ts`, `test/load-page.ts` and
`test/in-slot.ts`, the type tests in `test-d/release.ts`, and the unchanged `test/memory.ts`. All 25 failed before the
code existed. The `find()` then `follow()` case was added to an existing test afterwards. Per criterion:

- Unchanged behavior without `onRelease()`: every existing test passes without changes.
- No slowdown: timed with a scratch script on a `master` worktree and on this branch in the same process, 20 measured
  runs each after 5 warm-up runs, both orders, twice. A `find()` over 3000 elements with 5 steps after it: medians
  118/118, 113/110, 168/150 and 122/112 ms (`master`/branch). A `recurse()` over 150 pages: 1954/1995, 2019/1917,
  1778/1818 and 1966/1930 ms. The differences go both ways and stay within the run-to-run spread.
- `recurse()` bound, held pages, `follow()`, skipped and failed pages, `fetchPage()`, repeated `next(req)`, failing
  callbacks, callbacks before `end`, values not reaching the next page: `test/release.ts`.
- `loadPage()`: `test/load-page.ts`. `inSlot()`: `test/in-slot.ts`. Types: `test-d/release.ts`, checked by `tsc`.
- The tests catch a wrong release rule: removing the marker from `find()`, `follow()` or `get()` (so they hold the page
  until they settle), or marking `data()` to let go when it returns, each makes a test in `test/release.ts` fail.

## Follow-ups

- osmotic-plugin-playwright: add the page commands, and raise its `osmotic` peer dependency to `^3.2.0` after this is
  published.
