# chore/update-dependencies

## Prompts

1. Starting request, on a clean `master` at 3.3.0.

   > update each dependency to their latest version and make sure the tests pass. if they do, push, create pr and merge without waiting for human approval

2. `npm outdated` listed undici, prettier, domhandler (5 → 6) and @types/node (24 → 26). Claude objected to the
   two major updates: cheerio 1.2.0, the latest, still depends on domhandler ^5, and domhandler 6 is ESM-only. CI
   tests on Node 22 and 24, so @types/node 26 would allow APIs users don't have. Claude recommended updating only
   undici and prettier.

   > Skip both (Recommended)

## Interpretation

Update every dependency to its latest version where that fits osmotic: undici to 8.12.4 and prettier to 3.10.1.
domhandler stays at 5.0.3 and @types/node at 24.19.2, the latest of their current majors. Run the tests and the
Prettier check, and merge through a pull request if they pass.

## Type

Other (dependency updates).

## Version bump

Patch: the published undici range moves from `^8.12.3` to `^8.12.4`. The prettier update is dev-only.

## Decisions

- domhandler stays on 5: its types and node checks have to match the nodes cheerio produces, and cheerio
  depends on ^5. domhandler 6 is also ESM-only, while osmotic is CommonJS.
- @types/node stays on 24: it should match the oldest Node major CI tests (22/24), not the newest release.
- Prettier stays pinned to an exact version. 3.10.1 formats a trailing comment after a statement differently,
  so three lines in `README.md` were reformatted.
- npm rewrote `package-lock.json` with tab indentation. It was set back to 2 spaces so the diff only shows the
  version changes.
