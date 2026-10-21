# feature/pushback-rule

## Prompts

1. Sent while Claude was writing memory tests. The maintainer had suggested comparing memory between `master` and the
   branch in CI, and then, as an alternative, comparing two chains. Claude built the first and then dropped it in favor
   of the second, explaining why.

   > Also, add a rule to CLAUDE.md to push back on bad ideas, ideas that would not solve the issue, or ideas to solve an
   > issue that has a better approach

2. A review of this pull request found that "If any answer is no" fits the first two questions but not the third ("Is
   there a better approach?"), that the rule dropped the plan's "clearly" better, and that type Other plans may have no
   Decisions section to record an objection under. The maintainer agreed with the findings.

   > apply the suggested changes.
   > reword the third question to Is this the right approach?

## Interpretation

Add a rule to CLAUDE.md: before acting on a request, check that it is a good idea, that it would solve the problem it is
meant to, and that there isn't a clearly better approach. If any of these fail, say so before doing the work, with
reasons and an alternative, and let the maintainer decide. If the maintainer goes ahead anyway, do it as asked and
record the objection and the decision in `PLAN.md`. The same applies when a problem with the approach shows up halfway
through the work.

## Type

Other (workflow documentation).

## Version bump

None. Nothing in the published package changes.
