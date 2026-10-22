# fix/publish-step

## Prompts

1. Claude offered to run `npm run build` and `npm publish` for 3.1.1, and the maintainer pointed out that
   `prepublishOnly` already builds. Claude published, and noted that CLAUDE.md's "After merging to master" still lists
   both commands.

   > yeah, change it to just npm publish

## Interpretation

In CLAUDE.md's "After merging to master", replace "Run `npm run build` and `npm publish`" with `npm publish` alone,
noting that `prepublishOnly` builds first.

## Type

Other (documentation).

## Version bump

None. Nothing in the published package changes.
