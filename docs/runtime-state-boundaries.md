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
- `createFsusUI()` installs an application-owned `FsusMessageService` onto each
  Vue `App` via `FSUS_MESSAGE_KEY` (`app.provide`) with the owning `AppContext`
  attached to its rendered host and automatic cleanup via `app.onUnmount()`
  (clearing timers, unmounting the container renderer, and removing the DOM
  host). Consumers access the bound service via `useFsusMessage()` (retaining
  ownership across asynchronous calls) or `createFsusMessageService()`.
  `FsusMessage` routes calls made inside an active Vue injection context to the
  owning app's service and otherwise uses a separate module-level convenience
  scope; `FsusMessage.closeAll()` clears only that global convenience scope
  (use `useFsusMessage().closeAll()` to close one app's messages). Server-side
  calls without a DOM host do not allocate timers or retain queues.
- `FsusNotification`, `FsusMessageBox`, and `FsusLoadingService` keep transient
  overlay state in memory without durable persistence.
- Virtual-list, autocomplete, focus-trap, upload, and table/tree-derivation
  caches are session-only and invalidate on component lifecycle, data changes,
  or explicit reset APIs.
- No core component persists user data to `localStorage`, `sessionStorage`,
  IndexedDB, cookies, or remote storage by default.
- Durable persistence belongs to the consuming application. Library-level
  caches must remain reconstructable from props, slots, and injected config.
