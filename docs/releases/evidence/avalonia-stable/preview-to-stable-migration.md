# Preview-to-stable migration

## Preview-to-stable migration

1. Replace project references with the packed NuGet packages when consuming from
   a product app.
2. Import `FsusUI.Avalonia.Themes` and `FsusUI.Avalonia.Icons` resources from
   the application root.
3. Use `FsusThemeManager` for runtime theme changes instead of mutating local
   resource dictionaries directly.
4. Replace Vue slots, services, directives, overlay behavior, and locale
   providers using `docs/avalonia/vue-migration.md`.
5. Review `docs/avalonia/platform-differences.md` for native template,
   typography, focus, and virtualization differences.

Preview API removals are blocked after the stable baseline unless a versioned
migration is added to `spec/avalonia/public-api/`.
