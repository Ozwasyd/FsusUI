# Batch3 native Web typography resources

Owner: the Batch3 parity fixture, not the application's default font host.
Classification: prescribed restoration of `spec/typography/baseline.json` and
`docs/design.md` §3; no new design intent, token, public API or platform override.
Source baseline: `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`.

The baseline's `vue/packages/demo-app/src/main.ts` imports the 400/500/700 CSS
from `@fontsource/google-sans@5.2.1` (font v67) and
`@fontsource/noto-sans-sc@5.2.9` (font v40). `style.css` consumes
`--el-font-family` and disables synthesis. The two archive SHA-512 integrities
in `provenance.json` match `pnpm-lock.yaml`. `official-source-checks.json`
records verification against Fontsource's release commit
`728f5ac019b578b42808c3672378dad2d327fe87`: licenses and metadata match byte
for byte; package JSON matches except its packaging `publishHash` field.
The Web, package locks and specification are unchanged.

## Asset identities and scope

| Native resource directory | Source subset | Literal native family | Real weights |
| --- | --- | --- | --- |
| `GoogleSans/Latin/` | `google-sans-latin` | `Google Sans 18pt` | 400, 500, 700 |
| `GoogleSans/Symbols/` | `google-sans-symbols` | `Google Sans 18pt` | 400, 500, 700 |
| `NotoSansSC/` | `noto-sans-sc-chinese-simplified` | `Noto Sans SC Thin` | 400, 500, 700 |

Each directory has `400.ttf`, `500.ttf`, and `700.ttf`. The Google Sans 500
legacy name is `Google Sans 18pt Medium`; Noto's is `Noto Sans SC Thin Medium`.
Their typographic families and OS/2 weight classes identify genuine 500 faces.
The literal `Thin` word is an upstream family name, not the requested weight.

This resource set covers the Batch3 fixture's Latin, symbols (including `✕`
and `↗`) and Simplified Chinese. It does not claim the entire multilingual
repertoire of the Web CSS. Noto's default subset is Latin and is insufficient.
The locked package also supplies a named Simplified Chinese asset with 7,946
cmap entries. `derive.py` checks every one of the fixture/specification's 45
Chinese codepoints against the actual numbered shards selected by the Web
CSS's unicode ranges, at each weight. Outlines, horizontal/vertical glyph
metrics, ascent/descent/line gap and units per em agree. This is source and
glyph equivalence evidence, not rendered visual acceptance.

The TTFs are decompressed WOFF2 containers. There is no merge, subset, rename,
instancing, synthesis or glyph edit. Every decoded table is byte-identical,
including name, cmap, outlines, metrics, OS/2, GSUB and GPOS. Only
`head.checkSumAdjustment` changes for the SFNT container. `provenance.json`
records original/derived asset SHA-256 hashes and every table's hashes.

## Copyright and licensing

All fonts retain SIL OFL 1.1. `Source/*/LICENSE` are the exact individual
license files in the locked packages, verified against the official release.
They are preserved alongside package metadata and the exact imported CSS.
`COPYRIGHT.txt` additionally preserves each actual binary name-table notice:
Google Sans's 2025 project-author copyright and Noto's Adobe 2014–2021
copyright with reserved name `Source`. The original name tables and license
URLs are unchanged. The derived names use neither the reserved name `Source`
nor a newly claimed brand. Format conversion is a Modified Version under OFL;
its permission and redistribution conditions continue to apply to these
assets. The enclosing repository's MIT license does not replace the font
licenses. The fonts are bundled with the fixture, not sold on their own.

## Fixture-local resolution

`FSUS_HEADLESS_GSANS=1` selects explicit Google Sans resource URIs and the
unique collection key `fonts:FsusVueParityTypographyNotoSansSC`, then the
specification's ordered system stack. Missing resources, wrong families,
wrong weights, styles or simulations are rejected. Noto's collection performs
literal family lookup at the exact requested weight: Avalonia 12's ordinary
embedded collection otherwise parses `Thin` as a weight token and fails to
find the pinned family. This collection retains the fonts' names and has no
system family mapping or default override. It is owned by each actual
FontManager's lifetime, not a separate test application.

Standalone mode (flag absent or not `1`) explicitly parses the specification's
system stack, including CJK-capable families before generic system families.
It does not claim that arbitrary machines have those families installed.
The fixture's window also supplies its local `FsusTypographyFamilyBody`
resource because the Empty template binds that resource directly. Fixture
markup, content, measurements, state semantics and capture assertions are
unchanged. The global host and its GoogleSans/Inter collections are untouched.

## Project include for the sole resource owner

This source branch does **not** edit the shared `.csproj`. Its owner must add:

```xml
<ItemGroup>
  <AvaloniaResource Include="Assets/VueParityTypography/**/*.ttf;Assets/VueParityTypography/Source/*/LICENSE;Assets/VueParityTypography/Source/*/COPYRIGHT.txt" />
</ItemGroup>
```

Use singular `AvaloniaResource`, which Avalonia 12 consumes. The unique URI
prefix is
`avares://FsusUI.Avalonia.HeadlessTests/Assets/VueParityTypography/`.
The include adds exactly nine TTFs, two original licenses and two copyright
notices. Do not move them under the existing global GoogleSans resource prefix.
`ResourceInclude.patch` is the portable hunk for coordinated integration.

## Reproduction

Use Python 3.12, `fonttools==4.61.1`, and `brotli==1.2.0`. Download only the two
exact tarballs named in `provenance.json`, naming them `google-sans.tgz` and
`noto-sans-sc.tgz` in an external directory. `derive.py` verifies their complete
SHA-512 integrities before reading assets:

```sh
python dotnet/FsusUI.Avalonia.HeadlessTests/Assets/VueParityTypography/derive.py \
  /path/to/tarballs /path/to/FsusUI
```

`VALIDATION.md` records this increment's actual original-project checks,
selectors, tool and lock identities, and pending integration/visual gates.
Rollback is to remove the three owned source areas and the owner's resource
include together; no SDK, lock, token, theme-manager or golden change is needed.
