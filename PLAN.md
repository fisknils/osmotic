# fix/pr-review-strictness

## Prompts

1. The pr-review agent reviewed PR #11 and gave the verdict "ready to merge" while reporting a should-fix finding (the
   TSDoc on `Spec` didn't mention a new rule). Claude fixed it and merged.

   > The review-agent should be more picky. When it finds something that should be fixed, don't say ok for merge

## Interpretation

Change `.claude/agents/pr-review.md` so that:

- "Ready to merge" is only given when there are no blocking and no should-fix findings. Any should-fix finding makes
  the verdict "changes needed". Nits alone don't block.
- "Should fix" no longer means "doesn't block the merge"; it means a real problem that must be fixed before merging,
  just less severe than a bug.
- The agent is pickier: it checks that every place describing the changed behavior was updated, including TSDoc, code
  comments, error messages, README and CHANGELOG, also on lines outside the diff; and when unsure between nit and
  should fix, it picks should fix.

## Type

Other (agent configuration).

## Version bump

None. Nothing in the published package changes.
