# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/).

## [3.1.1] - 2026-10-22

### Fixed

- A command registered with `Osmotic.command()` or a plugin under the name of one of
  the chain's internal fields, such as `steps`, `state` or `events`, registered without
  an error but couldn't be called. These names work as commands now.
- A command named `opts` now throws "already exists" when it's registered, like a
  command named after a method. Before, it registered but couldn't be called.

## [3.1.0] - 2026-10-21

### Added

- List specs `["selector", { key: spec }]` extract one object per match, each spec
  resolved relative to it. Several of them in one `.set()` capture several groups of
  repeated items, such as offers and specifications, from one page into one row.
  The list's selector takes the [selector extras](README.md#selector-extras), but no
  `@attr`.

## [3.0.0] - 2026-10-21

### Breaking changes

- `.csv()` is removed. CSV export moved to the
  [`osmotic-plugin-csv`](https://www.npmjs.com/package/osmotic-plugin-csv) plugin and
  is used through the new `.export()` command, with the same options.
- The `CsvOptions` type is no longer exported; it comes with the plugin.
- `run()` now fails when an exporter fails to close.

To migrate, install `osmotic-plugin-csv`, load it, and replace `.csv(path, options)`
with `.export('csv', path, options)`:

```js
Osmotic.plugins([require('osmotic-plugin-csv')]);

Osmotic.get(url) /* ... */
	.export('csv', 'out.csv', { delimiter: ',' })
	.run();
```

### Added

- `.export(type, file, options?)` writes each row to a file in the format of an export
  type. Export types come from plugins, so a plugin can provide a format under any
  type name, independent of the file extension.
- `Osmotic.exporter(type, factory)` registers an export type.
- Plugins can add export types through a new `exporters` field.
- Exported types `Exporter`, `ExporterFactory`, `ExportTypes` and `ExportOptions`.
  Plugins declare their types' options by merging into `ExportTypes`.

### Changed

- `stats.rows` in the `end` event maps each export file to its row count.

### Fixed

- `Osmotic.plugins()` rejects a plugin whose `commands` is an array. Before, `[fn]` registered a command named `0`.

## [2.1.0] - 2026-10-21

### Added

- `Osmotic.plugins(list)` loads plugins: npm packages that add commands and fetch
  middleware. A plugin is an object `{ name, commands?, fetch? }`, or a function that
  returns one. See [Plugins](README.md#plugins) for the format and publishing
  conventions.
- Exported types `OsmoticPlugin` and `PluginInput`.
- `examples/plugin.js`.

## [2.0.1] - 2026-10-21

### Fixed

- Installing no longer triggers npm's `allow-scripts` warning. The build moved from the
  `prepare` script to `prepublishOnly`, so the package has no install scripts. Run
  `npm run build` after cloning the repository.

## [2.0.0] - 2026-10-21

The package is renamed from `@fisknils/osmo` to `osmotic`.

### Breaking changes

- Install `osmotic` instead of `@fisknils/osmo`.
- The `Osmo` class is renamed to `Osmotic`, and the `OsmoOptions` type to `OsmoticOptions`.
- The default `userAgent` is now `osmotic/0.1` instead of `osmo/0.1`.
- TypeScript command declarations augment `declare module 'osmotic'` with `interface Osmotic`.

To migrate, update the install and imports:

```js
// Before
const { Osmo } = require('@fisknils/osmo');
// After
const { Osmotic } = require('osmotic');
```

### Added

- Run events through `.on(event, handler)` and `.off(event, handler)`: `start`, `page`,
  `skip`, `error` and `end`. The `end` payload includes run stats: pages fetched, URLs
  skipped by `robots.txt` and rows written per CSV file.
- Fetch middleware can carry `onStart` and `onEnd` hooks, which `useFetch()` registers
  as `start` and `end` handlers.
- Exported types `OsmoticEvents`, `OsmoticEvent`, `Handler`, `RunStats` and `SkipReason`.
- TSDoc comments on the public API, shown in editors on hover.

### Changed

- Registering an `error` handler replaces the default console output for failed requests.

### Fixed

- A page whose `Response` has no URL, such as one built by fetch middleware, now uses
  the requested URL instead of an empty one.
- Calling `fetchPage()` after `run()` has finished now throws instead of reusing the
  previous run's state.

## [1.0.3] - 2026-10-20

Last release as `@fisknils/osmo`.

[3.1.1]: https://www.npmjs.com/package/osmotic/v/3.1.1
[3.1.0]: https://www.npmjs.com/package/osmotic/v/3.1.0
[3.0.0]: https://www.npmjs.com/package/osmotic/v/3.0.0
[2.1.0]: https://www.npmjs.com/package/osmotic/v/2.1.0
[2.0.1]: https://www.npmjs.com/package/osmotic/v/2.0.1
[2.0.0]: https://www.npmjs.com/package/osmotic/v/2.0.0
[1.0.3]: https://www.npmjs.com/package/@fisknils/osmo/v/1.0.3
