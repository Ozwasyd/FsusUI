# Tree fallback fixture fonts

Role: test-resource provenance. Applies to the Tree fallback-provider Headless
fixtures. The upstream releases and accompanying licenses own these font bytes;
the existing tests own their glyph, pixel, provider and lifecycle assertions.

These are unmodified, full upstream static faces. They are not subset, converted
or generated fixtures. The tests select the embedded families explicitly under
`avares://FsusUI.Avalonia.HeadlessTests/Assets/TreeFallbackFonts`, independently of
installed fonts. This prefix is outside `Assets/Fonts/`, which the optional shared
Google Sans collection recursively enumerates. The resources belong only to the
non-packable Headless test project; production packages and the demo do not
reference that project.

## Noto CJK

The two original OTF files come from
[`notofonts/noto-cjk` commit `f8d157532fbfaeda587e826d4cd5b21a49186f7c`](https://github.com/notofonts/noto-cjk/tree/f8d157532fbfaeda587e826d4cd5b21a49186f7c):

- `Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf`, family `Noto Sans CJK SC`,
  version 2.004, copyright 2014-2021 Adobe.
- `Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf`, family `Noto Serif CJK SC`,
  version 2.003, copyright 2017-2024 Adobe.

The original identical `Sans/LICENSE` and `Serif/LICENSE` are retained as
`OFL-NotoCJK.txt` (SIL Open Font License 1.1). Each OTF retains all 65,535 original
glyphs and its embedded copyright and license metadata. Both faces contain the
Chinese glyphs required by the unchanged fixture.

## DejaVu Sans

`DejaVuSans.ttf` is the original full version 2.37 face from the official
[`dejavu-fonts/dejavu-fonts` release `version_2_37`](https://github.com/dejavu-fonts/dejavu-fonts/releases/tag/version_2_37),
whose tag resolves to commit `0eda8a319c08835009849583cd090bb5b141ce25`.
It is extracted unchanged from
[`dejavu-sans-ttf-2.37.zip`](https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-sans-ttf-2.37.zip),
official release asset 2070165, 417,746 bytes, SHA-256
`5c6e497a2f36552cb5ffb112c413a6af39c0f3c47653662b90b4fa6499822fd7`.
The upstream source repository does not track generated TTF files; the release
archive binds this face rather than an invented source-font Git blob.

The original archive `LICENSE`, byte-identical to `LICENSE` at that tag, is
retained as `LICENSE-DejaVu.txt`. It includes the Bitstream Vera and Arev notices;
DejaVu changes are public domain. The font retains all 6,253 original glyphs and
its license metadata. Its absence of the Chinese glyph remains an explicit test
precondition.

## Byte identities

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `NotoSansCJKsc-Regular.otf` | 16,437,364 | `2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b` |
| `NotoSerifCJKsc-Regular.otf` | 24,543,080 | `2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca` |
| `DejaVuSans.ttf` | 757,076 | `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954` |
| `OFL-NotoCJK.txt` | 4,301 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` |
| `LICENSE-DejaVu.txt` | 8,816 | `7a083b136e64d064794c3419751e5c7dd10d2f64c108fe5ba161eae5e5958a93` |

The immutable upstream Git blobs are
`dc15562470b4f842321894787a0d066879ccff8b` (Noto Sans),
`cba8a4783cc38574ac7cda52cae7d9b4241c07a5` (Noto Serif),
`d952d62c065f3f35fb83a173496e90b21525aef3` (Noto license), and
`df52c1709bea171104d41bf084313ea434858423` (DejaVu license).
The extracted DejaVu font's local Git blob is
`e5f7eecce43be41ff0703ed99e1553029b849f14`.

The three font payloads total 41,737,520 bytes (39.80 MiB). Embedding these exact
bytes avoids a network or operating-system font prerequisite during the tests.
This fixture-only change needs no package changeset and makes no production
typography or visual acceptance claim.
