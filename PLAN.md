# chore/lockfile-tabs

## Prompts

1. While updating dependencies (#23), npm rewrote `package-lock.json` with tabs, and Claude set it back to the
   2-space indentation it had on `master` to keep the diff small.

   > Why would you set it to 2 spaces? I hate spaces. What even is the argument against tabs?

2. Claude agreed there is no argument against tabs, noted that npm would keep switching the file to tabs, and
   offered to convert the lockfile on its own branch.

   > ok, let's keep the spaces for now, so we can commit, push and merge. But then I want to create a separate branch that switches to tabs. And, if possible, enforce it in prettier

## Interpretation

Re-indent `package-lock.json` with tabs, like the rest of the repository, and have the Prettier check enforce it:
remove the file from `.prettierignore` so `npm run format:check` (and CI) fails when the lockfile is not
tab-indented. Prettier formats `package-lock.json` with its `json-stringify` parser, which matches how npm writes
the file, so npm and Prettier don't disagree on anything but indentation, and `useTabs` settles that.

## Type

Other (formatting).

## Version bump

None: the lockfile is not published, and nothing in the package changes.
