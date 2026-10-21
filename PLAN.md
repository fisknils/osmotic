# feature/plan-prompt-context

## Prompts

1. Claude had opened the second pull request, whose description is the branch's `PLAN.md`. Its Prompts section listed
   the prompts as bare quotes, such as "ok", and the first pull request's did the same.

   > It doesn't make sense to _only_ add my prompts to PLAN.md. Especially since it shows up in the pull request.
   >
   > example: (the first pull request's Prompts section)
   >
   > Tells the reader nothing about what I'm replying to

## Interpretation

Change the Prompts section of the `PLAN.md` template in CLAUDE.md so each prompt comes with a short note on what it
responds to (a question, suggestion, result or state of the work), followed by the prompt quoted verbatim. A reader of the
plan or the pull request should understand each prompt without the conversation. The open and merged pull requests'
descriptions were rewritten the same way.

## Type

Other (documentation of the workflow).

## Version bump

None. Nothing in the published package changes.
