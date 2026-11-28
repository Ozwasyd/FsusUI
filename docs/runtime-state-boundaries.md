# Runtime State Boundaries

FsusUI runtime services and plugin defaults keep interactive state in memory,
scoped to the Vue app that owns the rendered tree.

- `createFsusUI()` installs an application-owned configuration scope onto each
  Vue `App` via `FSUS_CONFIG_KEY` (`app.provide`), isolating independent client
  and `createSSRApp()` instances. Nested `FsusConfigProvider` /
  `provideFsusConfig()` scopes inherit only from their owning ancestor scope
  and preserve explicit local overrides.
- Explicit global configuration helpers (`setFsusGlobalConfig`,
  `getFsusGlobalConfig`) act only as a module-level fallback when neither
  `createFsusUI()` nor an ancestor `FsusConfigProvider` has provided
  `FSUS_CONFIG_KEY`; installing another Vue app never mutates the fallback or
  another app's configuration.
- `FsusMessage`, `FsusNotification`, `FsusMessageBox`, and `FsusLoadingService`
  keep transient overlay state in memory; per-app service ownership and unmount
  teardown follow the owning Vue app's `AppContext` boundary.
- Virtual-list, autocomplete, focus-trap, upload, and table/tree-derivation
  caches are session-only and invalidate on component lifecycle, data changes,
  or explicit reset APIs.
- No core component persists user data to `localStorage`, `sessionStorage`,
  IndexedDB, cookies, or remote storage by default.
- Durable persistence belongs to the consuming application. Library-level
  caches must remain reconstructable from props, slots, and injected config.
