For every new feature, create a feature branch. Name format: feature/branch-name
For every fix, create a fix branch. Name format: fix/branch-name

Commit messages should be short and informative.
If needed, split up changes (files) into many commits for more valuable commit messages.

Before merging to master:

- The version in package.json must be bumped according to the semantic versioning standards.
- CHANGELOG.md must be updated.
- Read README.md and determine whether an update is necessary.

After merging to master:

- the source branch should be deleted.
- run `npm run build` and `npm publish`
