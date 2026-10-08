# First actionable causes

Original candidate `3edfed2c6d119a302b7d50031e300761d1d22e59`; fresh base `a96047c3a281df6f0ae035f27fc471ad4a645173`; corrective continuation `74a232ff312f1ded70007beb224c9218ecc2ad7e`. No full visual rerun.

Current52 classes:22 snapshots,17 CDN diagnostics,4 status-slot mismatches,3 local request aborts,5 Markdown stress timeouts,1 TreeSelect audit timeout. Prior51 row artifact is unavailable here; its reported class delta is CDN−1, stress+1, TreeSelect+1, other class totals unchanged.

## npm-preparer

Command: `pnpm package:candidate:build; fast reproduction after its compiled output: node scripts/prepare-npm-package.mjs --strict`

Unable to rewrite bundled workspace dependency reference in dist/index.full.js.

Substring check fires on @element-plus/icons-vue in bundled license comment; there are zero exact quoted dependency specifiers. Runtime rewrite resolver then rejects dist/ instead of recognizing there is nothing to replace.

Owner/action: Canonical #827 packaging producer; no package-source edit by original825. Owner should require an actual quoted dependency reference before resolving its replacement; preserve strict import-leak checks. Use compiled bundle diagnostic JSON; no full build needed to reproduce first failure.

Candidate/base blobs: scripts/prepare-npm-package.mjs: identical, scripts/package-candidate.mjs: identical

## boundary-server

Command: `node scripts/boundary-playwright-owner-run.mjs --owner playwright-boundary --group main --runtime-dir .tmp/visual-runtime --skip-prepare --evidence-dir .tmp/issue825-3ed-boundary --server-port 5442`

http://127.0.0.1:5442 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.

Owner starts its managed preview, but child only gets port and CI=true. Config starts a second strict server on that same port. All8 cells fail setup, zero product tests.

Owner/action: Explicit continuation setup scope. Implemented on separate e72d117914412315c19b484f79304039cddb665e: pass existing FSUS_PLAYWRIGHT_EXTERNAL_SERVER protocol; omit child-owned server only for that URL. Strict standalone port rejection preserved.

Candidate/base blobs: scripts/boundary-playwright-runner.mjs: identical, vue/playwright.boundary-audit.config.ts: identical

## alias-ssr

Command: `node scripts/motion-playwright-owner-run.mjs --owner playwright-motion --group main --cell motion-ssr/chromium --evidence-dir .tmp/issue825-3ed-motion-clean`

[Vue warn]: Hydration node mismatch: rendered on server [object Comment]; expected on client span at <ElButton onClick=fn> at <SsrMotionFixture>; Hydration completed but contains mismatches.

Component Vue resolves through preserved Blog-owned alias to3.5.33 while createSSRApp/renderToString/server-renderer resolve UI3.5.32. Same C isolated all3.5.32 passes4/4; alias root fails4/4.

Owner/action: Local-alias dependency owner / SSR fixture owner; original825 must not rewrite alias. Implemented74a232ff public vue/server-renderer import. Preserved Blog alias resolves paired Vue3.5.33/renderer3.5.33. Original probe4 PASS; first clean owner run3 PASS/1 cadence-count FAIL(15<16) retained; dedicated clean-SHA owner cell4 PASS. Whole owner remains FAIL because required view/browser cells are missing.

Candidate/base blobs: vue/tests/motion-ssr/serve-motion-ssr.mjs: identical, vue/packages/demo-app/src/ssr-motion-server.ts: identical, vue/packages/demo-app/src/ssr-motion-app.ts: identical, vue/packages/demo-app/vite.config.ts: identical, pnpm-lock.yaml: identical

## npm-cache

Command: `NPM_CONFIG_CACHE=/workspace/.setup/issue825-npm-validation-cache pnpm test:package-candidate (isolated library)`

Original fixture invocation: ENOENT mkdir /home/agent/.npm/_cacache.

Candidate helper strips lowercase npm_config_*; uppercase ordinary NPM_CONFIG_CACHE survives and permits task-local writes. This is a local cache-path failure, not an npm dependency-permission refusal.

Owner/action: Task-local execution setup. Already repaired without source modification; immutable package guards and heavy-feature2 tests PASS, consumer fixtures13 PASS. No npm registry/auth settings changed.

Candidate/base blobs: scripts/npm-candidate-lib.mjs: identical

## locked-il-link

Command: `RestoreLockedMode=true pnpm run dotnet:platform:verify (MSBuild environment property); emitted failing subprocess: dotnet restore dotnet/FsusUI.Avalonia.slnx --disable-parallel --maxcpucount:1`

NU1004 Microsoft.NET.ILLink.Tasks reference10.0.8→10.0.12; committed lock inconsistent with selected SDK10.0.401.

Existing canonical #827 SDK/lock/provenance mismatch prevents locked producer and qualified alignment, NuGet and nativeAOT candidates.

Owner/action: Canonical #827 sole SDK/lock producer. Owner must align selected SDK and committed restore provenance; no independent lock changes or unlocked restore.

Candidate/base blobs: dotnet/FsusUI.Avalonia/packages.lock.json: identical, dotnet/FsusUI.Avalonia.Icons/packages.lock.json: identical, dotnet/FsusUI.Avalonia.Themes/packages.lock.json: identical

## demo-cdn

Command: `pnpm exec playwright test --config=vue/playwright.config.ts --project=desktop-light vue/tests/visual/capture-all.spec.ts '--grep=capture\ data' --workers=1`

GET https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png net::ERR_CERT_AUTHORITY_INVALID

Repeated strict diagnostics from same demo image dependency (two cube.elemecdn image URLs in demo-state.ts:131/133), propagating to17 failed tests. Eight motion cases are diagnostics, not failed motion geometry. Curl --head --fail without TLS bypass returns200 for official image; no official-dependency permission refusal is evidenced.

Owner/action: Demo dependency/asset owner; do not edit another component owner or disable certificate diagnostics. Portable browser failures and successful strict-curl connectivity evidence supplied. Owner can source trusted public demo assets through existing asset pipeline; no test interception or validation bypass.

Candidate/base blobs: vue/packages/demo-app/src/demo-state.ts: identical, vue/tests/support/page-diagnostics.ts: identical, vue/tests/demo-app-dev/demo-app-dev.spec.ts: identical

## status-fixture

Command: `pnpm exec playwright test --config=vue/playwright.config.ts --project=desktop-light vue/tests/visual/markdown-editor-chrome.spec.ts '--grep=renders\ toolbar,\ status,\ and\ slot\ visibility\ contract' --workers=1`

Expected status slot to contain 已同步到草稿箱; received serialized structured state twice.

Chrome fixture:29 destructures structured state and renders slotState twice while original test:426 expects supplied prose status text. Fixture and test are byte-identical to current main; mismatch is already in accepted base, not introduced by command-more candidate. Controlled default-toolbar source reproduces it.

Owner/action: Canonical Markdown status fixture / #429 owner. Route exact fixture/API mismatch; original825 has not rewritten frozen fixture, expectations or slot public contract.

Candidate/base blobs: vue/packages/demo-app/src/sections/MarkdownEditorChromeVisualSection.vue: identical, vue/tests/visual/markdown-editor-chrome.spec.ts: identical

## chrome-snapshot

Command: `pnpm exec playwright test --config=vue/playwright.config.ts --project=mobile-light vue/tests/visual/markdown-editor-chrome.spec.ts '--grep=renders\ framed\ chrome\ in\ source\ mode\ with\ correct\ geometry\ and\ semantics' --workers=1`

toHaveScreenshot mismatch (individual pixel counts and snapshot names retained in52 rows).

22 unchanged snapshots fail. Default-toolbar controlled subtraction also reproduces22 failures: body/padding/scroll captures differ; candidate/control toolbar-only changes are43–418px normal and2159–2238px zoom, below unchanged1.2% tolerance. Six minimal captures byte-identical. A full fresh-main render is NOT proven.

Owner/action: Canonical Markdown chrome/runtime fixture owner. Use inspected candidate/control captures and preserved baseline evidence to repair owning renderer/fixture; no golden or threshold change.

Candidate/base blobs: vue/tests/visual/markdown-editor-chrome.spec.ts: identical, vue/packages/demo-app/src/sections/MarkdownEditorChromeVisualSection.vue: identical, vue/packages/theme-chalk/src/markdown-editor.scss: different, vue/packages/components/markdown-editor/src/markdown-editor.vue: different

## local-abort

Command: `pnpm exec playwright test --config=vue/playwright.config.ts --project=desktop-light vue/tests/visual/markdown-editor-chrome.spec.ts '--grep=keeps\ one\ editor\ instance\ through\ rapid\ mode\ switches' --workers=1`

Local demo request net::ERR_ABORTED retained by strict page diagnostics.

Three local request cancellation diagnostics, one involving rapid Markdown mode switching; unchanged test/fixture source. Controlled default-toolbar case also reproduces request abort. Exact initiating request URLs/actions retained in original traces. Deeper cancellation cause not yet proven.

Owner/action: Canonical Markdown runtime/lifecycle #641/#640 coordination. Route exact trace request/action rather than marking ordinary cancellation an environment waiver. Renderer has canonical borrowed two-line pending-theme listener change relative main; no new duplicate kernel.

Candidate/base blobs: vue/tests/support/page-diagnostics.ts: identical, vue/tests/visual/markdown-editor-chrome.spec.ts: identical, vue/packages/components/markdown-renderer/src/markdown-renderer.vue: different

## markdown-stress

Command: `pnpm exec playwright test --config=vue/playwright.dev.config.ts vue/tests/demo-app-dev/demo-app-dev.spec.ts '--grep=dev\ server\ markdown\-stress\ route\ has\ no\ browser\ diagnostics' --workers=1`

Test timeout60000ms / expected markdown-stress-status complete, received rendering (other case page.evaluate timeout).

Five development cases time out; recovered missing52nd row is markdown-stress route has no browser diagnostics, with bare60000ms timeout. Original terminal and trace exist; older extractor omitted it because no trace action error. Rendering/scroll sampling never settles; deeper algorithmic cause remains unproven, so no fabricated attribution to toolbar.

Owner/action: Canonical Markdown runtime/render-pipeline #641/#640 coordination. Portable exact commands, original trace and first errors supplied; isolate canonical render pipeline before changing limits or tests.

Candidate/base blobs: vue/packages/demo-app/src/sections/MarkdownStressSection.vue: identical, vue/tests/demo-app-dev/demo-app-dev.spec.ts: identical, vue/packages/components/markdown-renderer/src/markdown-renderer.vue: different

## tree-select-audit

Command: `pnpm exec playwright test --config=vue/playwright.config.ts --project=desktop-light vue/tests/visual/audit.spec.ts '--grep=audit\ component\ styles' --workers=1`

locator.evaluate timeout60000ms waiting for unique-tree-select .el-select__popper .el-tree-node__content hasText Level one1.

One original audit times out at audit.spec.ts:54 while attempting to focus TreeSelect item. Candidate/base audit source identical; no command-more API is involved. Precise fixture DOM/locator mismatch requires owning TreeSelect audit inspection.

Owner/action: TreeSelect/audit fixture owner. Route exact locator and captured error context; no TreeSelect component edit or force-green assertion by original825.

Candidate/base blobs: vue/tests/visual/audit.spec.ts: identical

## strict-counts

Command: `node --test tests/contract-v2.test.mjs`

Candidate3ed contract tests46 PASS/3 stale exact-count FAIL.

Accepted main test counts lag regenerated owned authorities. Canonical #827 source0027 contains exact current counts2115/410/124/116/26 with no weakened predicates.

Owner/action: Explicit metadata continuation scope; canonical source consumed. Exact canonical blob8f0ab4b37c47a160a0cd09e0f1f5f65ddaaeef9f applied;49/49PASS.

Candidate/base blobs: tests/contract-v2.test.mjs: identical

## expired-overrides

Command: `pnpm conformance`

platform override governance failed: scroll-anchoring-avalonia-presenter and visual-markdown-source-surface-002 expired reviewAfter2026-10-01.

After correcting stale count tests, conformance now reaches two existing expired governed overrides. Files unchanged from accepted main.

Owner/action: Governance/override owners; renewal is an owner decision, not original825 setup fix. Remain FAIL. Do not extend dates, change thresholds or waive expiration.

Candidate/base blobs: spec/platform-overrides/avalonia-virtualization.yaml: identical, spec/platform-overrides/visual-thresholds.yaml: identical

## drawer-safe-area-after-setup

Command: `node scripts/boundary-playwright-owner-run.mjs --owner playwright-boundary --group main --cell visual-boundary-audit/safe-area-chromium --runtime-dir .tmp/visual-runtime --skip-prepare --evidence-dir .tmp/issue825-e72-boundary --server-port 5444`

Error: drawer-ttb/landscape-notch must stay inside safe rect {"left":59,"top":0,"right":785,"bottom":369,"width":726,"height":369} under profile landscape-notch

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 10

- Array []
+ Array [
+   Object {
+     "bottom": 71,
+     "className": "el-drawer__close-btn",
+     "left": 765,
+     "right": 819,
+     "role": "button",
+     "top": 17,
+   },
+ ]

   at ../support/dom-layout-assertions.ts:776

  774 |     offenders,
  775 |     `${label} must stay inside safe rect ${JSON.stringify(safeRect)} under profile ${profile.id}`,
> 776 |   ).toEqual([])
      |     ^
  777 | }
  778 |
  779 | /**
    at assertControlsInsideSafeRect (/workspace/FsusUI/vue/tests/support/dom-layout-assertions.ts:776:5)
    at runCase (/workspace/FsusUI/vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts:253:3)
    at /workspace/FsusUI/vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts:330:9

Original product assertions now execute: Drawer ttb landscape-notch close control spans left765,right819,top17,bottom71; safe rect right785. Tests1 PASS/1 FAIL. Runtime prepared from unchanged component inputs; no second server collision.

Owner/action: Drawer/safe-area owner, outside original825 component ownership. Route exact geometry/reproduction; assertions, safe inset simulation and 54px hit target remain strict. Remaining cases in same loop are unrun after first failing assertion.

Candidate/base blobs: vue/packages/components/drawer/src/drawer.vue: identical, vue/packages/theme-chalk/src/drawer.scss: identical, vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts: identical, vue/tests/support/dom-layout-assertions.ts: identical

