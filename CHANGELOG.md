# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/).

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

[2.0.0]: https://www.npmjs.com/package/osmotic/v/2.0.0
[1.0.3]: https://www.npmjs.com/package/@fisknils/osmo/v/1.0.3
