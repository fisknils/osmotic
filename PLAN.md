# feature/repository-links

## Prompts

1. "now that we have a github repo, we should add it to package.json"
2. "Can the "author" field be an array?"
3. "Set my handle (fisknils) as author. I'm not comfortable sharing my email. as contributors, you may add me and you."

## Interpretation

Add the `repository`, `homepage` and `bugs` fields to `package.json`, pointing at https://github.com/fisknils/osmotic, so
the npm page links to the source, the README and the issue tracker.

Set `author` to the handle fisknils with a link to the GitHub profile and no email, and list fisknils and Claude under
`contributors`.

## Type

Other (package metadata).

## Version bump

None. 3.0.0 isn't published yet, so these fields ship with it.
