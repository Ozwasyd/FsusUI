# Icon Alignment Conformance

Representative icons must keep the same semantic viewport and visual alignment
intent across Web and Avalonia generated artifacts.

Required representative checks:

- `search`: centered circular form, md size token, md stroke token.
- `settings`: centered mechanical form, md size token, md stroke token.
- `warning`: status icon, non-decorative by default, md size token.
- `chevron-right`: navigation glyph, RTL-mirroring reviewed before use in
  directional controls.
- line icons: shared viewport, `currentColor`, `stroke-linecap="round"`,
  `stroke-linejoin="round"`, and the md stroke token.
- solid icons: shared viewport and `currentColor` fill. Solid icons may keep
  source stroke metadata for compatibility, but the alignment contract does not
  require round-stroke attributes.

Web checks compare generated Vue exports and registry metadata. Avalonia checks
compare generated `StreamGeometry` resources and `FsusIconKeys` constants.
Platform-specific differences must be registered under
`spec/platform-overrides/`.
