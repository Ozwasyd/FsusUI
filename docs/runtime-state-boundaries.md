# Runtime State Boundaries

FsusUI runtime services keep interactive state in memory, scoped to the Vue app
that owns the rendered tree.

- `ElMessage`, `ElNotification`, `ElMessageBox`, and app-installed `$loading`
  use `AppContext`-scoped queues or fullscreen state.
- Virtual-list, autocomplete, focus-trap, upload, and table/tree-derivation
  caches are session-only and invalidate on component lifecycle, data changes,
  or explicit reset APIs.
- No core component persists user data to `localStorage`, `sessionStorage`,
  IndexedDB, cookies, or remote storage by default.
- Durable persistence belongs to the consuming application. Library-level
  caches must remain reconstructable from props, slots, and injected config.
