# npm Public Preview Package Audit

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`
Candidate commit: this file's containing commit

## Commands

```bash
pnpm run build:github-package
cd dist/element-plus
npm pack --dry-run --json
pnpm pack --dry-run
find dist/element-plus \( -name ".env" -o -name ".env.*" -o -name ".npmrc" -o -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.pfx" -o -name "id_rsa*" -o -name "id_ed25519*" \) -print
rg -n "workspace:|_authToken\s*=\s*(?!\$\{)|BEGIN [A-Z ]*PRIVATE KEY|github_pat_|ghp_|gho_|npm_[A-Za-z0-9]{20,}" dist/element-plus/package.json dist/element-plus/README.md dist/element-plus/es dist/element-plus/lib dist/element-plus/dist dist/element-plus/theme-chalk
```

## Result

Passed for candidate package `@ozwasyd/element-plus@1.5.0`.

`pnpm run build:github-package` prepared the GitHub Packages candidate and reported:

```text
Prepared @ozwasyd/element-plus@1.5.0 for GitHub Packages from Ozwasyd/FsusUI with 87798 self-reference rewrites across 1711 files, 6 worker references rewritten, 9 WASM fallback references rewritten, and 3676 source maps pruned.
```

The prepared package manifest contains no `workspace:` dependencies. `dist/element-plus/.npmrc` exists for local GitHub Packages publish configuration, contains only `@ozwasyd:registry=https://npm.pkg.github.com`, and is not included in the npm pack manifest.

## Audit Checklist

| Item                                                        | Status | Evidence                                                                                  |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| No `.env` files                                             | Passed | npm pack manifest reports `.env: 0`                                                       |
| No packed `.npmrc` files                                    | Passed | npm pack manifest reports `.npmrc: 0`                                                     |
| No `.npmrc` tokens                                          | Passed | `dist/element-plus/.npmrc` contains only the GitHub Packages registry line                |
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
  "size": 7371138,
  "unpackedSize": 90673679,
  "entryCount": 6109,
  "shasum": "81dba4120f72c287982fa7b09a0ece7243234270",
  "integrity": "sha512-HB4sYG1RlvntGJqSHaAhKcJsyuGdPRCtaSPzsmiFoBDucezoGATfONA6f+UnsPN1MFm1YIHoJlJP/1PLXB0vfA==",
  "bundled": []
}
```

`pnpm pack --dry-run` completed successfully for the same candidate package and reported `ozwasyd-element-plus-1.5.0.tgz`.
