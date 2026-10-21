# fix/command-name-shadowing

## Prompts

1. The review of #15 found that a new `host` field hid a plugin command named `host`, which #15 fixed with an ES
   private field. Issue #16 was opened for the older instance fields with the same problem on `master`, and Claude
   recommended doing it before #4.

   > fix issue #16

2. The pr-review agent found the pull request ready to merge, with one optional nit: the changelog didn't say that
   code reading the internal fields at runtime stops working. Claude proposed posting the review, adding that line,
   resolving the conversation and merging.

   > doit

## Interpretation

`Osmotic.command()` and `Osmotic.plugins()` check whether a command name is taken with `name in Osmotic.prototype`.
Instance fields aren't on the prototype, so a command named after one registers without an error and is then hidden
by the field on every instance: calling it fails with "is not a function".

Fix it as issue #16 proposes:

- The private fields (`steps`, `exports`, `fetchMiddleware`, `events`, `state`, `pluginFetch`) become ES private
  fields (`#steps` and so on), which aren't properties, so commands with those names register and work.
- `opts` is public and stays a property, so registering a command named `opts`, directly or through a plugin, fails
  with "already exists", like a command named after a method. The check covers every own property of an instance, so a
  future public field is covered too.

## Type

Bugfix

## Breaking change

No. The fields were private in TypeScript and undocumented. JavaScript code could read them at runtime
(`chain.steps`); that stops working, but it was never part of the API. Registering `opts` threw no error before but
gave a command that couldn't be called, and now throws at registration.

## Version bump

Patch (3.1.0 → 3.1.1)

## Scope

- `src/core/Osmotic.ts`: the six fields as ES private fields, and one check for taken names used by
  `Osmotic.command()` and `Osmotic.plugins()`.
- Tests in `test/extend.ts` and `test/plugins.ts`, and the changelog.
- Left out: the private methods (`visit`, `skip` and so on) are on the prototype, so commands with their names are
  already rejected with "already exists". Making them ES private too would free those names, but nothing needs that.

## Acceptance criteria

- [x] A command named after each former private field (`steps`, `exports`, `fetchMiddleware`, `events`, `state`,
      `pluginFetch`) registers with `Osmotic.command()` and works when called in a chain. (test/extend.ts)
- [x] `Osmotic.command('opts', …)` throws "already exists". (test/extend.ts)
- [x] A plugin with an `opts` command is rejected with "already exists", and nothing in its list is loaded.
      (test/plugins.ts)
- [x] Chains run as before: the existing tests pass unchanged.

## Affected public API

- `Osmotic.command()` and `Osmotic.plugins()`: commands named after the former private fields now work; a command
  named `opts` is rejected.
- The emitted `.d.ts` shows `#private` instead of the private field declarations.

## Impact on the rest of the codebase

- Checked: every use of the six fields in `src/` (all inside `Osmotic.ts`), `test/`, `test-d/`, `examples/` and the
  four sibling plugins (none reads them), and both callers of the name check (`command()`, and `plugins()` through
  `PluginHost.hasCommand`).
- Found: None.

## Decisions

- The name check creates an instance and looks at its own properties, rather than listing `opts` by name, so a
  public field added later is covered without updating the check. Creating an instance only builds its empty state and
  registers plugin hooks on its own emitter, so it has no side effects.
- The README now says which names are taken, since it said nothing about it before.

## Verification

- The three new tests were committed before the fix and failed against it: the six commands named after fields were
  "not a function", and `opts` registered without an error, directly and through a plugin. `tsc` also rejected the
  test file, since the interface merge clashed with the private fields.
- With the fix, `npm test` passes, 119 tests, with the existing ones unchanged.
- The emitted `dist/core/Osmotic.d.ts` shows `#private` instead of the six private field declarations.

## Follow-ups

- Publish 3.1.1 after merging.
