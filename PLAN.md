# fix/agent-section-links

## Prompts

1. Right after the `issue-triage` and `pr-review` agents were merged, VS Code's prompt-file checker flagged
   `.claude/agents/pr-review.md`: "File '#posting-an-approved-review' not found at
   'D:\Projects\node\osmotic\.claude\agents\#posting-an-approved-review'."

   > pr-review.md is listed as having an issue in vscode: (the diagnostic above)

## Interpretation

The checker reads Markdown links in agent files as links to files, so a link to a section (`[text](#anchor)`) points to
a file that doesn't exist. Replace the three section links in the two agents, one in `pr-review.md` and two in
`issue-triage.md`, with plain references to the section by name, which the agent reads the same way.

## Type

Other (agent instructions).

## Version bump

None. Nothing in the published package changes.
