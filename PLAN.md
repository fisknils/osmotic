# fix/ignore-local-settings

## Prompts

1. Claude added a permission rule to `.claude/settings.local.json` so the pr-review agent can post approved reviews, but
   couldn't check whether git ignores that file.

   > gitignore does not ignore that file

2. Claude offered to add the file to `.gitignore` through a branch and pull request, or to the local
   `.git/info/exclude` only, and recommended the first since every contributor using Claude Code gets such a file.

   > 1

3. The first attempt was branched from `feature/list-of-objects-spec` by mistake, so it carried that feature's commits.
   Claude stopped and proposed restoring that branch and rebuilding this change from `master`.

   > solve it.
   >
   > the .gitignore change should be merged alone.

## Interpretation

Add `.claude/settings.local.json` to `.gitignore`, so personal Claude Code settings, such as permission rules, are never
committed by accident. The branch holds only this change, based on `master`.

## Type

Other (repository configuration).

## Version bump

None. Nothing in the published package changes.
