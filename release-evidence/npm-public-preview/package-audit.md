# npm Public Preview Package Audit

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`
Candidate commit: this file's containing commit

## Commands

```bash
pnpm run build:npm-package
cd dist/element-plus
npm pack --dry-run --json
pnpm pack --dry-run
find dist/element-plus \( -name ".env" -o -name ".env.*" -o -name ".npmrc" -o -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.pfx" -o -name "id_rsa*" -o -name "id_ed25519*" \) -print
rg -n "workspace:|_authToken\s*=\s*(?!\$\{)|BEGIN [A-Z ]*PRIVATE KEY|github_pat_|ghp_|gho_|npm_[A-Za-z0-9]{20,}" dist/element-plus/package.json dist/element-plus/README.md dist/element-plus/es dist/element-plus/lib dist/element-plus/dist dist/element-plus/theme-chalk
```

## Result

Passed for candidate package `@ozwasyd/element-plus@1.5.0`.

`pnpm run build:npm-package` prepares the npm public registry candidate and writes `publishConfig.access = "public"` with `publishConfig.registry = "https://registry.npmjs.org/"`.

Observed build output:

```text
Prepared @ozwasyd/element-plus@1.5.0 for npm public registry from Ozwasyd/FsusUI with 87798 self-reference rewrites across 1711 files, 6 worker references rewritten, 9 WASM fallback references rewritten, and 3676 source maps pruned.
```

The prepared package manifest contains no `workspace:` dependencies. The npm package candidate must not contain `.npmrc`, private registry configuration, source maps, or token-like content.

## Audit Checklist

| Item                                                        | Status | Evidence                                                                                  |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| No `.env` files                                             | Passed | npm pack manifest reports `.env: 0`                                                       |
| No packed `.npmrc` files                                    | Passed | npm pack manifest reports `.npmrc: 0`                                                     |
| No `.npmrc` files                                           | Passed | `find dist/element-plus -name '.npmrc'` returned `0`                                      |
| No private tokens                                           | Passed | refined token scan found no `_authToken`, private key, GitHub token, or npm token matches |
| No `workspace:` dependencies                                | Passed | prepared `package.json` dependency scan returned `[]`                                     |
| No private registry URL in package contents                 | Passed | refined registry scan found no packed private registry config                             |
| Source map policy checked                                   | Passed | `find dist/element-plus -name '*.map'` returned `0`                                       |
| WASM runtime artifacts present without debug source bundles | Passed | pack manifest includes runtime `.wasm` and `.mjs` artifacts; source maps are pruned       |
| No private screenshots or docs                              | Passed | pack manifest reports `private-user-images: 0`, `tests/: 0`, `__tests__/: 0`              |

## Pack Summary

`npm pack --dry-run --json` summary:

```json
{
  "id": "@ozwasyd/element-plus@1.5.0",
  "name": "@ozwasyd/element-plus",
  "version": "1.5.0",
  "filename": "ozwasyd-element-plus-1.5.0.tgz",
  "size": 7371336,
  "unpackedSize": 90676641,
  "entryCount": 6109,
  "shasum": "119b28e51bb74c952bae174682bf4e5b9c7e7dd2",
  "integrity": "sha512-Ht1xLAYwKlf8zuUQ7hx+59v4iPvTBJJ5J3+riqQzYZb+vMCRd0Y9sk8bfgM6zrFBI+bNVK7z3KXeYkCURGJlgQ==",
  "bundled": []
}
```

`pnpm pack --dry-run` completed successfully for the same candidate package and reported `ozwasyd-element-plus-1.5.0.tgz`.
