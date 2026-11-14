# feature/run-timing

## Prompts

1. At the end of a successful run, osmotic logs `Done. Fetched <n> page(s).`

   > When osmotic finishes, it prints "Done. Fetched <pages fetched> page(s)."
   >
   > I would like to add the time consumed, and an average of how long each page took to load as well as the top 3
   > slowest pages.

2. Sent while Claude was reading the code, before any plan or code was written.

   > actually, skip the top- 3 slowest pages. Just go with the total time consumed and average time per page

## Interpretation

The summary line that `run()` logs after a successful run also says how long the run took, from the start of `run()`
until the line is logged, and the average load time of the fetched pages. A page's load time is the same `ms` that its
`page` event reports, so the average is the mean over pages. It isn't the total time divided by the number of pages,
which concurrency would make smaller. With no pages fetched there is no average, so the line gives only the total time.
The slowest pages are not listed.

## Type

Feature

## Breaking change

No. The logged line changes, but it isn't part of the API: `stats` in the `end` event is unchanged.

## Version bump

Minor

## Scope

- Changes the `Done.` line of `run()`, for example `Done. Fetched 3 page(s) in 1.5 s, 500 ms per page on average.`
- Durations under a second are given in whole milliseconds, under a minute in seconds with one decimal, and longer as
  minutes and whole seconds (`2 min 5 s`).
- Left out: the slowest pages (dropped in prompt 2), and adding timing to `RunStats`.

## Acceptance criteria

- [x] After a successful run, the summary line gives the number of pages, the total time and the average page load
      time.
- [x] The average is the mean of the pages' load times, not the total time divided by the pages.
- [x] Durations of a second or more are given in seconds, and of a minute or more in minutes and seconds.
- [x] With no pages fetched, the line gives the total time and no average.

## Affected public API

None. Only the console output of `run()` changes.

## Impact on the rest of the codebase

- Checked: callers of `run()`'s console output (`test/run.ts`), README sections that quote the summary line, the
  `page` event's `ms`, `RunState` and its users in `src/core/Osmotic.ts`.
- Found: `test/run.ts` asserts the old line exactly.

## Decisions

- `test/run.ts` asserts `Done. Fetched 4 page(s).` exactly. The requirement for that line changes on this branch, so
  that assertion is updated to the new format. It is the requirement changing, not the test being fitted to the code.

## Verification

`test/run.ts` covers every criterion. It mocks `Date`, so time passes only where a test advances the clock: in fetch
middleware for each page's load time, and in a `start` handler for time outside page loads. The lines are therefore
checked exactly:

- `the summary gives the total time and the average page load time`: 100, 200 and 300 ms pages give
  `in 600 ms, 200 ms per page on average`.
- `the average is over page load times, ...`: 900 ms more in the `start` handler makes the total `1.5 s`, while the
  average stays at 200 ms (total divided by pages would give 500 ms).
- `without pages the summary has no average, ...`: a start URL that 404s and 125 s in the `start` handler give
  `Fetched 0 page(s) in 2 min 5 s.`
- `run() logs a summary` checks the format of the line in a run with a real clock.

The new tests failed before the code was written (commit b539964), and `npm test` passes with 147 tests.

## Follow-ups

- The timing could also go into `RunStats` (`stats` in the `end` event) for code that wants it, but this branch leaves
  that out.
