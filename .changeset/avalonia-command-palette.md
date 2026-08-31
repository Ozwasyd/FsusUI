---
'element-plus': minor
---

Add a production Avalonia `FsusCommandPalette` that binds the shared native-menu
command tree without template access. It provides case-insensitive local and
async-provider search, nested navigation, wraparound keyboard and pointer
activation, live hidden/disabled predicates, virtualized accessible results,
IME-safe query commits, busy/failure states for async execution, and overlay
focus restoration. `FsusPlatformCommand` now exposes cancellable async execution
and live visibility/enabled predicates.
