# feature/export

## Prompts

1. "I think we need to re- evaluate the .csv command. I've been thinking about adding more types of export formats, like sitemap, jsonl etc, and what I arrived at is that we need to make it more clear what we're doing. We're making an export. Maybe we can add an export command which takes two arguments: type and file, like .export('csv', 'myexport.csv') We _could_ simply parse the type from the file- extension, but that would make it impossible to write a plugin for csv that solves things differently than the default, if that would be needed, since that type would already be taken. In fact, let's remove the csv functionality altogether and move it into a plugin. Set it up in ..\osmotic-plugin-csv"
2. "rebase feature/export"
3. "Can we write a test for the export feature, or did we shoot ourselves in the foot by removing the only working type?"
4. "write the tests anyway."

## Interpretation

Replace `.csv(path, options)` with a general `.export(type, file, options)`. Export types are registered by plugins
(a new `exporters` field) or with `Osmotic.exporter(type, factory)`; the type is never taken from the file extension, so
any plugin can offer its own take on a format under its own type name. osmotic ships no export types. CSV moves to a
new package, `osmotic-plugin-csv`, in `../osmotic-plugin-csv`.

## Type

Feature.

## Breaking change

Yes. `.csv()` and the `CsvOptions` type are removed. Migrate by installing and loading `osmotic-plugin-csv`, and
replacing `.csv(path, options)` with `.export('csv', path, options)`. A run whose exporter fails to close now fails.

## Version bump

Major: 3.0.0.

## Scope

In: `.export()`, `Osmotic.exporter()`, plugin `exporters`, the `ExportTypes` declaration point for options, removing
`.csv()`, docs, and the new CSV plugin.

Out: other export types such as JSON Lines or sitemaps, and updating `osmotic-plugin-playwright` for osmotic 3.

## Acceptance criteria

- [ ] `.export()` with an unknown type throws when the chain is built, and the message says to load a plugin.
- [ ] The exporter is created on the first row of a run, with the `file` and `options` given to `.export()`.
- [ ] A run without rows creates no exporter, and the summary says so.
- [ ] `write()` is called once per row with its data, and a promise it returns is awaited before the branch continues.
- [ ] `end()` is called once per run, also when a step fails.
- [ ] An `end()` that fails fails the run and is reported by the `end` event; after an earlier failure, the earlier
      error is kept and the close error is logged.
- [ ] `stats.rows` maps each export file to its row count, and each run gets a fresh exporter and count.
- [ ] `Osmotic.exporter()` throws for a type that already exists.
- [ ] Plugins register export types through `exporters`; a type that is taken throws and loads nothing from the list;
      `exporters` that isn't an object of functions is rejected.
- [ ] Options of a type declared in `ExportTypes` are type-checked; undeclared types take any object.
- [ ] `.csv()` and `CsvOptions` are gone.
- [ ] `osmotic-plugin-csv` writes CSV through `.export('csv', …)` with the former options, tested in its own repo.

## Affected public API

- Removed: `.csv()`, `CsvOptions`.
- Added: `.export(type, file, options?)`, `Osmotic.exporter(type, factory)`, the `exporters` field of `OsmoticPlugin`,
  and the types `Exporter`, `ExporterFactory`, `ExportTypes` and `ExportOptions`.
- Changed: `stats.rows` is keyed by export file; `run()` fails when an exporter fails to close.

## Impact on the rest of the codebase

- Checked: every use of `CsvSink`, `sinks` and `.csv(` in `src/`, `examples/`, the README and the tests; the run
  lifecycle in `run()` (start, steps, closing, `end` event, state reset); plugin loading and its all-or-nothing checks;
  the TypeScript entry points; and the sibling repos `osmotic-plugin-playwright` and `osmotic-plugin-csv`.
- Found:
  - `run()` now fails when an exporter can't close a file, which `.csv()` never did.
  - `export` is now a method of `Osmotic`, so no plugin can add a command with that name.
  - The summary line still says "Wrote N row(s)" for a file whose exporter then fails to close.
  - `osmotic-plugin-playwright` uses `.csv()` in its README and declares `osmotic ^2.1.0`.

## Decisions

- The type is a separate argument, not read from the file extension, so a plugin can provide a format under its own
  type name and file names are free.
- The exporter is created lazily on the first row, so runs without rows create no files, as `.csv()` did.
- The tests were written after the code, against this plan's criteria, because the code came before the test-first rule.
  To check that they test something, some of the code was broken on purpose and the matching tests were seen to fail.

## Verification

## Follow-ups

- Publish osmotic 3.0.0 before `osmotic-plugin-csv` 1.0.0, which needs it as a peer dependency.
- `osmotic-plugin-playwright`: replace `.csv()` in its README and raise its peer dependency to `^3.0.0`.
