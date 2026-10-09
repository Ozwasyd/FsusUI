# Table test mode successor

Actual source: `a5e839e4160ec64dafabb162c6168851de54b1b1`, branch `integration/public-declaration-table-test-modes-20261009`. Its frozen predecessor remains `2d05f240e5fb04ac0cd602b4ed638ffe00b1859b` on its separate branch. This successor consumes only owner offer `c95d49a2f89b19b122f164fcb553c3af3724fff0`. Both offered preimage bytes matched the actual 2d05f files before cherry-pick.

The only two changed paths are Table's `table-core-popper-return.test-d.ts` and `table-core-popper-declaration-controls.mjs`. Exact resulting blobs are respectively `3e14a4e6de2ee329e1bac35249a18d8b8a19b4c1` and `a17df0e8453c447dbe449eb00b1039c791f00ba6`. Production implementation, compiler options/config, source manifest, npm authority, lock and producer scripts are unchanged. The actual official declaration source filter excludes both changed files. Changeset not needed for this test-only successor; the earlier consumer source changes keep their existing Changesets.

| Actual check at a5e839 | Result |
| --- | --- |
| `pnpm typecheck:vitest:no-cache` | PASS, exit 0; previous 2d05f had one TS2344 |
| Positive exact Vitest file/count/name discovery | PASS, two named Table cases |
| `pnpm test run vue/packages/components/table/__tests__/table-core-popper-return.test.ts` | 2 PASS, jsdom |
| Owner declaration controls with original 48ac source preimage | PASS |
| Strict source / original producer declaration / emitted consumer controls | Original 2/1/2 TS2344 → fixed 0/0/0 |
| Original Vitest non-strict-null compiler-mode source contracts | Original 1 error → fixed 0; null remains assignable to both types in this mode |
| Strict source and emitted declaration nullability | Fixed Table=false and core=false for accepts-null, strictNullChecks=true |
| Runtime generated JS parity for Table util | PASS, SHA256 d061ef5089fedd95db3f9c298fdcd46a99ee8f3e96e17aab0aebeee941239c8b |
| Exact two file lint, --no-ignore | PASS |
| `pnpm test:deps-check` | PASS, all official positive/negative mutation controls |
| Documentation architecture contract and fixtures | PASS |
| Fresh main conflict check | PASS, no conflict with 8db0ac8f49749e3e5f28be5051bb3d3ed71ada71 |

The new assertion compares Table return nullability against the actual core return in each mode. This does not use the non-strict mode as a non-null proof: independent strict source and emitted declaration checks explicitly inspect both actual types and retain the original negative controls. `controls/controls.json` records all four mode/result sets for both phases. The actual producer remains TypeScript 5.9.2, with original config preserved; the full actual Vitest check uses the repository vue-tsc script.

No repeated canonical package build, full installed-package check, source web check or other unchanged broad suites were run on this test-only successor. The last actual production artifact remains frozen at source 2d05f, SHA256 `6da2fe1a5573a04768a4f8280899b45dabaa4f93ca72a278d48c50faca17649a`; it is not relabelled as an a5e839 artifact. Its actual full installed strict declaration check remains FAIL 10, and exact producer observation remains twelve independent TS7056. Its canonical build/verify, fresh frozen install, eight strict standalone motion checks, web typecheck, 22 focused Table/Markdown runtime cases and dependency controls remain recorded at their actual source in separate authority evidence.

Cascader/Slider/classic Select/DatePicker are newly reserved by the root coordinator: this worker did not modify them. TimeSelect and Pagination await the real Select source effect. No shared focus-trap, private consumer CSS, duplicate kernel, local alias, security/CSP, compiler failure control, package version, credential/App grant, publication, default branch push or merge was changed. Browser/device geometry, Firefox/WebKit, published-registry and remote CI remain OPEN/UNRUN. Existing alias remains 73a61e481fc6a2f684704585c496d004f86000cc. All earlier frozen implementation/evidence branches are preserved.

Root coordinator alone manages draft PR/issue metadata and a separate reviewer handles any merge. `draft-pr-material.json` identifies this successor as the latest source head while retaining the correct artifact provenance. Rollback is reverting this isolated cherry-pick; it does not require changing the alias or producer inputs.
