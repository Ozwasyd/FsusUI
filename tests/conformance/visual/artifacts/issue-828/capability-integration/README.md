# Canonical source integration for the viewport chain

Supplemental WIP evidence, qualificationEligible=false. This branch consumes exact parent-authorized implementations from their canonical owners. It does not implement or close #825/#826/#827 a second time. It does not replace #828's independent UX acceptance, full visual failures, invalid preimplementation classification or real consumer/device evidence.

## Source and capability boundaries

Fresh fetched/ls-remote main: f2b3bb89ffe5f749da26c388f058efdbb6aee864. Base #851 source 5d6541461ccd96bd9edba0a223635920682a8e13 includes #828 spacing source ad82fbc053a7a19a1ca23d06e10446dd3b11d475, canonical icon/theme fixes and public fixture types. Frozen prior candidates and the separate original full visual run remain untouched.

- #825 PR852 5d4d61be5bc642f3460b8b0fb29cdfd6a6c7315b -> -x 4866e916f8a74c9e4e00b7b88fc381c3d4b39463: MarkdownEditor overflow is beside the horizontal primary commands in normal flow. Counts, tray identity, disabled states and Escape focus return remain.
- #827 PR853 6d7d1cf50fc7622690003db4956398fb7d130fb2 -> -x 599ebe4ab1cae03d84163724f7d72d4b337c8136: closing/hidden Drawer panel is inert/aria-hidden and top/bottom close controls consume safe insets. Shared focus trap remained untouched in that owner's commit.
- #826 PR854 1db9cfcf3510bfed1ee34ba8a6afe8efa3ed0684 -> -x 42ecd78e01f0e8f52ad4ccbd7ffb87fea0d1c3d6: sole shared focus-trap owner captures pointer opener without moving focus, cancels stale deferred work and preserves nested-layer ownership. No local kernel edits.

All three actual GitHub PR heads and source objects were verified before consumption. Original additive tests, nearest docs and changesets are retained. Sources may be consumed before upstream issue closure; their remaining runtime/browser/device gates are not inherited as passes.

Generated derivative commit1f2db698fb477f4722576f6c349934165835a280 uses only this candidate's original API-baseline producer; it does not change executable component code. Browser/unit source remains42ecd78. Its first commit hook attempt selected inactive platform pnpm and failed with mkdir ENOENT under the original home, not an assertion failure. Same commit after setup activation passed; partial first observation is explicitly labeled a summary, not a retained raw log.

## Actual commands and results

Commands ran in this isolated worktree with /workspace/.setup/activate.sh, pnpm10.33/Node24.19, managed Playwright browsers and the existing browser library path. Ports5275,5291,5298 were task isolated. Raw logs, original browser trace ZIPs and unmodified PNGs are archived in directories named for the tested source. No assertions, snapshots, published parity or producer admission were patched.

On source599ebe4:

- Original frozen-lockfile install exit0. First focused combined unit collection exit1:448 passed/55 files,19 missing local icon-entry collection failures. Original `pnpm run ensure:icons` exit0 built302 icons. The same original Vitest files then exit0:650 tests/74 files using --maxWorkers=1. First failure retained.
- Original focused Drawer/Dialog/focus-trap/viewport six-file Vitest command exit0:70 tests. Original `pnpm run build:theme` exit0. Full CSS13e583af3b51a13b3d9eb300fcefd64bdd775cdc5b8e485dbab20671b91a60ac; critical0434427378e195b0ca7899f3430c54495b8485183e9a636d0ff0a882fb66787d.
- `pnpm exec playwright test --config=vue/playwright.boundary-audit.config.ts vue/tests/visual-boundary/safe-area-drawer-interaction.spec.ts --project=safe-area-chromium`: exit0,10/10. Evidence capture repeat of the identical tests also exit0,10/10; it was not a failed-test retry.
- `pnpm exec playwright test --config=vue/playwright.markdown-editor.config.ts --project=chromium --trace=on`: original production demo build/preview, exit0,10/10 including six toolbar geometry and four existing command-surface cases. No real Blog backend is involved.
- Original documentation architecture and design-conformance checks exit0, receipts3/negative-controls12; actual AJV strictTypes warnings retained.

On source42ecd78:

- `pnpm exec vitest run --config vue/vitest.config.ts vue/packages/components/dialog vue/packages/components/drawer vue/packages/components/focus-trap vue/tests/boundary/safe-area-viewport.test.ts --maxWorkers=1`: exit0,75 tests/seven files. This is the actual selected test count; it is not the canonical owner's139-test report.
- `pnpm exec playwright test --config=vue/playwright.dialog-focus.config.ts --project=chromium --trace=on`: exit0,10/10 actual production-fixture builds and repeated pointer, interrupted close, keyboard Escape and nested focus interactions in light/dark. NO_COLOR/FORCE_COLOR warnings retained.
- Original ten Drawer Chromium tests above with --trace=on: exit0,10/10 after integrating the kernel; all four directions/light-dark, positive control bounds/hit targets, inert closing and destroy-on-close.
- Original Dialog WebKit command --project=webkit: exit1, ten launch refusals before any interaction; missing native libGLES dependencies. No WebKit assertion or real iOS acceptance is claimed. Original raw launch evidence remains.
- Original documentation architecture and design conformance exit0. `pnpm run api:check` exit1 because that script does not exist; the mistaken command is retained, then the repository's actual `avalonia:baseline:check` is used separately.
- First `pnpm run avalonia:baseline:check`: exit1, actual current `spec/baselines/vue-current.json` stale. Read-only original exported buildArtifacts projection proves only inputTreeHash/outputHash and an existing --fsus-space-1 source-file reference changed; no CSS variables were added/removed and API semantics are identical. First failure and projection retained. The original `pnpm run avalonia:baseline` then exit0 generated this candidate's own derivative, adding only the legitimate public-shell.scss token-use reference and current source/output metadata; subsequent original check exit0. No assertion/screenshot snapshot or authority changed, no other candidate's identity-only baseline copied. Internal generated derivative needs no consumer changeset.
- `pnpm run typecheck:web:no-cache`: exit0 on the actual vue/tsconfig.web.json project, independently of the owner's other project counts.
- Current complete focused chain command `pnpm exec vitest run --config vue/vitest.config.ts vue/packages/components/markdown-editor vue/packages/components/markdown-renderer vue/packages/components/public-shell vue/packages/components/drawer vue/packages/components/dialog vue/packages/components/focus-trap vue/tests/boundary --maxWorkers=1`: exit0,622 tests/75 files,86.44s. This is a different explicit selection from the earlier650-test command; counts are not interchanged.

## Render inspection and limits

Root independently inspected original Drawer top/bottom PNGs and light landscape/dark portrait production Editor frames extracted byte-for-byte from original Playwright traces. The actual overflow control is beside scrolling commands; closing, safe inset, focus and hit-test claims remain limited to the exact test assertions and component fixture. Fixture diagnostics outside the editor are visible in the captures, not concealed. Drawer geometry tests allow their original ±1px tolerance and do not prove Blog#2228's separate zero-gap scrim contract.

Original WASM source matches the #851 source, and only unchanged generated WASM dist was initially copied to this worktree before its original producer regenerated normal bundles. This is not receipt/native qualification transfer. Physical worktree directories/inodes are independent. Neither copied demo output nor fabricated admission receipt is used. Successful local Blog typecheck/build/source+dist document checks are recorded on Blog PR3931 by their own exact source head, not as a qualified live stack.

## Remaining actual acceptance

#828 expanded-search/inline/bottom universal header-budget conflict needs canonical contract adjudication; original invalid preclassification and rejected acceptance remain. Original #851 full Preview646/42 and separate Dev9/10 failures remain failed, with first Dev WASM admission refusal retained. This integration did not rerun or pass the whole full visual suite.

Canonical parent must assign the original inventory repair owner and legitimate Migration/ServerContract runtime producer/operator for the selected ordinary-serve versus formal-Test receipt route. Source exists; source is not a current receipt. No shared DB initialization, auth/CSP/security relaxation or field guessing. Actual Blog DebugStack/ReleasePreview/fixtures/AOT/hydration/negative controls remain unqualified. Native WebKit capability and real iOS17+ cutout/Home Indicator continuous capture plus independent verifier remain missing. Published-package-dependent parity remains unproved; local aliases are authorized for dev/testing without publication.

All issues stay open except already completed Blog#3477 reconciliation. No default push, merge, auto-merge, deployment or package publication. Later separate review/merge required. Rollback: revert this consumption branch only; canonical owner branches and frozen evidence remain intact.
