# feature/ci

## Prompts

1. "Can I approve my own PR if I start using that as a workflow?"
2. ""let GitHub Actions approve PRs"... Does that mean I can define automated tests that decide whether or not a PR is
   approved?"
3. "ok"
4. "And disallow forced pushes to master"

## Interpretation

Make pull requests the way changes reach `master` on GitHub, with automated checks as the gate instead of approvals: a
GitHub Actions workflow runs `npm test` and the Prettier check on every pull request and push to `master`; branch
protection on `master` requires a pull request (no approvals, since GitHub doesn't let authors approve their own), requires
the checks to pass, blocks force pushes and deletion, and applies to admins too. Describe the pull request workflow in
CLAUDE.md.

## Type

Other (continuous integration and repository settings).

## Version bump

None. Nothing in the published package changes.
