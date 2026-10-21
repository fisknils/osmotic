# feature/repository-links

## Prompts

1. The public GitHub repository had just been created. Claude pointed out that `package.json` had no `repository`,
   `homepage` or `bugs` fields, so the npm page wouldn't link to it.

   > now that we have a github repo, we should add it to package.json

2. Claude had added the three fields. `author` was still an empty string.

   > Can the "author" field be an array?

3. Claude explained that `author` is a single person and others go in `contributors`, offered to set `author` to the git
   user name, and asked whether to include an email, since it would be public on npm.

   > Set my handle (fisknils) as author. I'm not comfortable sharing my email. as contributors, you may add me and you.

## Interpretation

Add the `repository`, `homepage` and `bugs` fields to `package.json`, pointing at https://github.com/fisknils/osmotic, so
the npm page links to the source, the README and the issue tracker.

Set `author` to the handle fisknils with a link to the GitHub profile and no email, and list fisknils and Claude under
`contributors`.

## Type

Other (package metadata).

## Version bump

None. 3.0.0 isn't published yet, so these fields ship with it.
