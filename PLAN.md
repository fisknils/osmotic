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

- [ ] After a successful run, the summary line gives the number of pages, the total time and the average page load
      time.
- [ ] The average is the mean of the pages' load times, not the total time divided by the pages.
- [ ] Durations of a second or more are given in seconds, and of a minute or more in minutes and seconds.
- [ ] With no pages fetched, the line gives the total time and no average.

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

## Follow-ups
