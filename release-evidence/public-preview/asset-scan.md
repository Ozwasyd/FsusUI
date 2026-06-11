# Public Preview Asset Scan

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`
Candidate commit: this file's containing commit

## Commands

```bash
git ls-files | rg -i '\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$' > /tmp/fsusui-assets.txt
wc -l < /tmp/fsusui-assets.txt
rg -i '\.(png|jpe?g|gif|webp|avif|bmp|ico)$' /tmp/fsusui-assets.txt | wc -l
rg -i '\.svg$' /tmp/fsusui-assets.txt | wc -l
rg -i '\.(png|jpe?g|gif|webp|avif|bmp|ico)$' /tmp/fsusui-assets.txt | cut -d/ -f1-3 | sort | uniq -c
rg -i '\.svg$' /tmp/fsusui-assets.txt | cut -d/ -f1-2 | sort | uniq -c
git grep -nE '(private-user-images\.githubusercontent\.com|user-images\.githubusercontent\.com|/home/[A-Za-z0-9._-]+/|C:\\Users\\)' -- .
```

## Result

```text
total=337
bitmaps=44
svgs=293
bitmap_dirs:
     44 tests/visual/demo-app.spec.ts-snapshots
svg_dirs:
    293 packages/icons-svg
private-asset-path-strict-scan-exit=1
```

Tracked bitmap files are visual regression snapshots from the demo app. They
use synthetic component states and do not contain private user data.

Tracked SVG files are FsusUI icon source assets under `packages/icons-svg`.
They are covered by the MIT license lineage documented in `NOTICE` and
`packages/icons-svg/LICENSE`.

No private GitHub image attachment URLs, public user-image attachment URLs,
Linux home-directory paths, or Windows user-directory paths were found in the
tracked tree.
