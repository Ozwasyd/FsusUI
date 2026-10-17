# Paired diagnosis of the original 52 full visual failures

No PublicShell source fix is warranted by the paired Preview evidence so far. Baseline main reproduces 42 of the original 43 Preview failures; the dark form case passes on both baseline and candidate targeted replay. All 22 mobile screenshot failures produce **byte-identical and pixel-identical actual PNGs** on baseline and candidate. The baseline Dev replay is still running at this increment; no Dev baseline conclusion is claimed yet.

This diagnosis is separate from the immutable prior 48-entry evidence manifest and rejected UX receipt. It does not change those hashes or acceptance status. Issue #828 and draft PR #839 remain WIP; no source, test, assertion, snapshot, fixture, design authority, package publishing, merge, deployment or security override occurred during diagnosis.

## Exact inputs and method

- Fresh default-main fetch and `ls-remote`: `f2b3bb89ffe5f749da26c388f058efdbb6aee864`; remote has no master.
- Candidate evidence head tested: `55f7951abb75ee5b28f4781ed91ee5aa11f70320`; runtime source remains `c325c600ea2760156d467bfaa375613879211cd9`. The release-only changeset correction is `79988a85e5f893a5d06eb9ee499c07c3abc37e39`. Both SCSS files remain byte-identical to source c325.
- Parent independently produced baseline runtime in `/workspace/FsusUI-828-baseline`, using original runtime producer/checker: both exit 0, clean tracked tree. Baseline fingerprint `5b68ac63c74f12795fbb72e049195faffebb186c4a2deaa397366bb5d1010c75` differs from candidate intentionally. Candidate original runtime check exited 0; candidate demo fingerprint remains recorded in the prior source-bound manifest.
- Node/pnpm/browser activation remains the configured environment. Original Playwright specs/configs, existing expectations, screenshot thresholds and diagnostics were used. Separate result profiles and ports preserve first failures and avoid output overwrite. Exact commands/env/results are in `commands.json` and `baseline-preview-paired-summary.json`.

## Original failure index and source exposure

`failure-index.json` records every one of the original 52 tests, exact project/title/line, raw error, cause and source exposure. Counts:

| Original cause                                         | Preview | Dev |
| ------------------------------------------------------ | ------: | --: |
| External CDN certificate diagnostics in afterEach      |      12 |   5 |
| Screenshot differences                                 |      22 |   0 |
| Aborted local dynamic assets in rapid-switch afterEach |       4 |   0 |
| Fixture/status-slot text mismatch                      |       4 |   0 |
| Renderer/status text timeout                           |       0 |   4 |
| Slider overflow at 320px                               |       1 |   0 |

The motion and five original Dev gallery/Calendar failures occur in diagnostics afterEach, not the named motion/geometry/style assertions. Toolbar tests expect `已同步到草稿箱`, while the current `MarkdownEditorChromeVisualSection.vue` status slot renders metrics, state and capabilities. These facts do not authorize editing another owner's tests or fixture contract.

Every failing route loads `main.ts -> theme-chalk/src/fsus.scss -> index.scss -> public-shell.scss`. The affected specs and rendered sections have no PublicShell or SiteHeader reference. `demo-contract.ts` selects `App.vue`, which renders the gallery or route section under `demo-app-container`, rather than a public shell. Capture uses DataSection; form uses FormSection; editor cases use MarkdownEditorChromeVisualSection; stress cases use MarkdownStressSection.

The corrected diagnostic harness compiles baseline/current full and critical PublicShell SCSS, compares parsed selector/media/declaration rules, and checks actual production DOM at 16 route/theme/viewport observations. All **16 changed selector lists** are rooted in `.el-public-shell` or its elements. There are **zero PublicShell/site-header/mobile-dock/tab nodes and zero changed-selector matches** in those observations. This is change-impact evidence, not universal state or canonical browser qualification. An initial diagnostic extractor skipped modern CSSStyleRule nesting fields; its invalid zero-selector result is preserved and explicitly excluded. The corrected harness re-ran every observation without altering any repository test/helper.

## Actual paired Preview results

Parent baseline original targeted selection expands parameterized loops to **116 tests**: exit 1, **74 passed / 42 failed**, 3.4m. All 42 failures map to the original 43 failed Preview variants; zero additional failures. Only the dark-form overflow does not recur.

Candidate targeted groups:

| Group                                                                      | Result                                      | Limit/variation                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| G1 desktop-light capture-data + motion + rapid-switch + toolbar            | Exit 1; 0 passed / 7 failed                 | Same original causes                                              |
| G2 mobile screenshot cells + rapid-switch + zoom + toolbar + forced colors | Exit 1; 1 passed / 25 failed                | Mobile-light rapid-switch passes; aborted assets vary with timing |
| G3 desktop-dark capture loop + motion + rapid-switch + toolbar + form      | Exit 1; 8 passed / 7 failed                 | Capture loop adds pass controls; dark form passes                 |
| G5 mobile capture-data                                                     | Corrected retry exit 1; 0 passed / 2 failed | First anchored grep selected no tests, exit 1; not a test result  |

Candidate Preview totals **9 passed / 41 failed / 50**, covering every original failed Preview variant plus controls. The difference from baseline's 42 failures is the variable mobile-light rapid-switch diagnostic; dark form passes on both. Neither variation proves repair or regression.

`paired-screenshot-comparison.json` binds both origin paths, SHA256s and decoded dimensions for all 22 actual PNGs. Pillow RGBA comparison found zero differing pixels in each pair; encoded PNG bytes also match in every pair. One unchanged copy of each identical pair is archived under `paired-mobile-screenshots/`; no snapshot/baseline expectation was rewritten.

## Candidate Dev, baseline still pending

Original candidate Dev replay: exit 1, **9 passed / 10 failed / 19**, 5.7m. All original nine failed Dev tests reproduce. One additional Calendar-title case fails only afterEach with the same external CDN certificate diagnostics; its locale assertion did not fail. Parent's baseline Dev19 command is in progress in its separate worktree/profile/port; this increment does not classify those failures as baseline yet.

## Shared capability preflight and remaining gates

Exact commit `384112ac023a49a8a4fb605f31c05fbd25dd09f5` was fetched and its full diff verified. It changes only `InteractionTraceFixture.vue`: public `MarkdownEditorProfile` typing and the existing fallthrough `data-testid` binding pattern. It has no demonstrated causal connection to these 52 runtime failures and was **not consumed**. The diff is archived in `shared-public-types-384112.patch`; no sibling branch was guessed.

Original full visual **655 passed / 52 failed / 707, exit 1** remains an actual failed phase. Paired diagnosis does not make the complete suite or CI green. WebKit host admission, published-package parity, independent full/domain UX acceptance, other PublicShell states/heights and Blog's own canonical runtime/real-device gates remain unmet under their existing owners. No #828 source regression has been demonstrated in the paired Preview evidence; baseline Dev evidence is the next missing diagnostic capability owned by parent root.
