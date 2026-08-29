# Icon Alignment Conformance

Representative icons must keep the same semantic viewport and visual alignment
intent across Web and Avalonia generated artifacts.

Required representative checks:

- `search`: centered circular form, md size token, md stroke token.
- `settings`: centered mechanical form, md size token, md stroke token.
- `warning`: status icon, non-decorative by default, md size token.
- `chevron-right`: navigation glyph, RTL-mirroring reviewed before use in
  directional controls.
- `folder`: Files / workspace explorer navigation glyph, folder-shaped, md
  size token, md stroke token.
- `outline`: document outline / table-of-contents navigation glyph, memo- or
  list-shaped, md size token, md stroke token.
- `save-all`: stacked-floppy action glyph for save-all document headers, md
  size token, md stroke token.
- `close-all`: stacked-window action glyph with an X knockout for close-all
  document headers, md size token, md stroke token.
- `file` family (`file`, `file-text`, `file-markdown`, `file-code`,
  `file-data`, `file-image`, `file-archive`, `file-document`): shared page
  silhouette with folded corner, type-specific interior glyph, stable
  `file` fallback for unknown types, md size token, md stroke token.
- line icons: shared viewport, `currentColor`, `stroke-linecap="round"`,
  `stroke-linejoin="round"`, and the md stroke token.
- solid icons: shared viewport and `currentColor` fill. Solid icons may keep
  source stroke metadata for compatibility, but the alignment contract does not
  require round-stroke attributes.

Web checks compare generated Vue exports and registry metadata. Avalonia checks
compare generated `StreamGeometry` resources and `FsusIconKeys` constants.
`icon-baselines.json` is generated from the registry and records the Vue
component, Avalonia resource key, viewport, stroke metadata, token ids, and
source path hash for each representative icon.
Platform-specific differences must be registered under
`spec/platform-overrides/`.
