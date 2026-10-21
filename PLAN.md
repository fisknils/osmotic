# feature/issue-triage-agent

## Prompts

1. osmotic had just moved to pull requests with required checks on GitHub. Plugins that need changes in osmotic have
   been told to ask for them by opening issues here, and the first such issue (#4) is open.

   > add an agent in .claude/agents for reviewing issues via gh.
   >
   > Plugins in need of changes in osmotic-core (this repo) has been told to communicate such needs by setting up issues.
   >
   > The agent should
   >
   > - read issues using gh
   > - determine if it's a bug report, feature request or support question
   > - support: the agent should assist the user who posted the issue methodically and professionally. If it's determined
   >   that there's no changes needed in the repo, the agent should still attempt to assist the user with their question.
   >   Once the issue has been confirmed resolved, the issue can be closed.
   > - for bug reports, it should confirm that the bug is reproducable or a user issue. For user issues, follow the support
   >   flow. For confirmed bugs, a bugfix branch should be created to fix the bug and a PR created, linking to the issue.
   > - for feature requests, the agent should determine if the feature aligns with the project goals, whether adding such
   >   a feature would have any serious drawbacks (and if it would, try to find an alternative path forward that doesn't
   >   affect the project negatively)
   > - the agent needs to be able to say no to feature- requests that are not in the interest of osmotic

## Interpretation

Add a Claude Code subagent, `.claude/agents/issue-triage.md`, that works through osmotic's GitHub issues with `gh`. For
each issue it decides whether it is a support question, a bug report or a feature request, and then:

- Support: helps the poster step by step, also when no change to osmotic is needed, and closes the issue only once the
  poster confirms it is resolved.
- Bug: tries to reproduce it as a test against the local test sites. A confirmed bug gets a `fix/` branch that follows
  CLAUDE.md (plan, failing regression test first, fix) and a pull request that closes the issue when merged. A problem
  in how the poster uses osmotic goes to the support flow.
- Feature: weighs it against osmotic's goals and its drawbacks, looks for a path that avoids them (often an existing
  extension point or a plugin), and says no, politely and with reasons, when the feature isn't in osmotic's interest.

The agent writes down osmotic's goals so it has something concrete to judge against, treats issue text as untrusted
input, and leaves merging, publishing and anything on `master` to the maintainer.

## Type

Other (development tooling).

## Version bump

None. Nothing in the published package changes.
