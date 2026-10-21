# feature/memory-tests

## Prompts

1. osmotic has three safeguards against holding on to memory during a crawl, each explained in a code comment: built-in
   steps return `next()`'s promise instead of awaiting it, requests waiting for a slot carry the data without the parent
   page (`withoutPage()`), and extracted attribute values are copied (`detach()`). None of them had a test.

   > We had some issues previously with memory in osmotic, which has since been resolved, but I'm thinking it's a good
   > idea to create a test for it, so a change that causes the memory usage to grow is caught right away.

2. Sent while Claude was writing a test per safeguard: tests for whether specific pages are released, plus one measuring
   the heap after extracting values.

   > Maybe we can create a test that simply runs a reasonably long chain and reports the max mem usage, intended to be
   > used as a comparison (compare it's result on master with it's result on the new branch, flag if the difference is too
   > big)

3. Sent while Claude was building that comparison: a benchmark script, and a CI job running it against builds of
   `master` and the branch.

   > or compare the max usage from two different chains

## Interpretation

Add tests that fail when a change makes osmotic keep memory it should release:

- One test per safeguard: during a long crawl, the DOMs of finished pages are released; a page's DOM is released while
  requests for its links wait for a slot; and extracted values don't keep their pages' HTML alive. The first two count
  live DOMs through `WeakRef`s and forced garbage collection, which doesn't depend on timing or heap noise.
- One test comparing two chains: a short and a long crawl of the same kind should peak at about the same heap. If
  something is kept per page, the long crawl's peak grows with its length. It runs in every `npm test`, without building
  `master`.

## Type

Other (tests). No behavior changes.

## Breaking change

No.

## Version bump

None. Nothing in the published package changes.

## Scope

In: `test/memory.ts`; `test/helpers/memory.ts` (forced garbage collection, `LiveSet` for counting live objects,
`peakHeap()`); and an archive scenario site with long chains of heavy pages.

Out: changes to osmotic itself, and comparing memory between `master` and a branch (see Decisions).

## Acceptance criteria

- [x] Crawling a 30-page archive with `recurse()`, at most 3 page DOMs are alive at any page.
- [x] With one slot and a page linking to 20 articles, the page's DOM is collected while its articles are still queued.
- [x] Extracting a value of at least 13 characters from each of 10 pages of 1 MB keeps less than 3 MB alive.
- [x] The peak heap of a 168-page crawl is less than 1.5 MB above that of a 42-page crawl.
- [x] Each test fails when the leak it guards against is introduced, except where Decisions says why it can't.
- [x] The tests are stable over repeated runs.

## Affected public API

None.

## Impact on the rest of the codebase

- Checked: forcing garbage collection with `v8.setFlagsFromString('--expose-gc')` affects only the test file's own
  process, since each test file runs in its own; the scenario sites and helpers other tests use (only additions); and
  the run time of `npm test`.
- Found: `npm test` takes about 7 seconds longer, mostly the two-chain comparison, which forces a garbage collection at
  every page of three crawls.

## Decisions

- Test fixture fix: the first version of the extraction test measured 42 MB kept, even when keeping nothing, and with
  plain `fetch()` and no osmotic. The archive site built its pages by joining strings, which V8 stores as ropes and
  flattens in place the first time they are read, so serving each page grew the test's own memory by its size.
  `archive()` now builds flat strings. Recorded here because it changed a test after it was written; the expected values
  didn't change.
- `detach()` can't currently be tested. A plain `slice()` of a 1 MB page keeps the whole page alive (40 MB for 40 pages),
  so the danger is real, but cheerio's current parser (parse5) builds attribute values as new strings, and removing
  `detach()` changed nothing. The extraction test guards the outcome instead, and would catch the leak if cheerio's
  parser changes and `detach()` is missing. Criterion 3 was lowered from 40 pages and 10 MB to save time, since it
  can't fail on `detach()` alone.
- `peakHeap()` measures against the heap just before the run. Measuring against the heap after the run hid a leak that
  keeps every page, since memory never released is still there afterwards.
- The two-chain test runs a warm-up crawl first. Without it, one-time costs such as compiling code made the first, short
  crawl measure higher than the long one.
- It compares the difference between the crawls, not their ratio: without a leak the difference stayed under 0.6 MB,
  while a ratio threshold let a 20 kB-per-page leak pass.
- The comparison with `master` (prompt 2) was built as a benchmark script and a CI job, then dropped in favor of the
  two-chain test (prompt 3): that catches every leak that grows with the crawl, in every `npm test`, without building a
  second version or comparing two noisy runs. What only the `master` comparison would catch is a constant increase that
  doesn't grow with the crawl, judged not worth the cost and noise for now.

## Verification

`npm test` passes: 104 tests. The memory tests passed in each of five runs in a row, at about 7 seconds.

Each leak was introduced on purpose and the tests were run against it:

| Leak introduced                                      | Result                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `recurse()` awaits its branches instead of returning | 30 of 30 DOMs alive in the long-crawl test; two-chain fails |
| `follow()` carries the page into queued requests     | The queued-requests test fails                              |
| `detach()` removed                                   | No test fails (see Decisions)                               |
| Every page's DOM kept on the instance                | Two-chain fails: 42 MB against 159 MB                       |
| 20 kB kept per page                                  | Two-chain fails: "about 21 kB more per page"                |
| 10 kB kept per page                                  | Not caught: below the threshold of about 12 kB per page     |

## Follow-ups

- If constant increases in memory become a concern, revisit comparing with `master` in CI.
