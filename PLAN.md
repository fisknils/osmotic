# fix/npm-keywords

## Prompts

1. After #13 added npm keywords, Claude pointed out that `headless` and `javascript-rendering` describe
   osmotic-plugin-playwright rather than osmotic, which fetches plain HTML. The maintainer removed them from
   `package.json`.

   > fine. I removed them. commit, push, open pr, merge

## Interpretation

Remove the keywords that describe the browser plugin rather than osmotic, as edited in `package.json`.

## Type

Other (package metadata).

## Version bump

None. The keywords reach npm with the next published version.
