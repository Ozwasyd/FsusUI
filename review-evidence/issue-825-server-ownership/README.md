# Issue 825 managed-server ownership correction

Implementation source: d456f80e2f411ca81b4e98168638411e09eeac6a, separate `fix/issue-825-server-ownership` branch; parent 74a232 remains frozen. This archive is evidence only and must not be merged into product source.

The original managed owner command was run with `--owner=playwright-boundary --group=main --cell=visual-boundary-audit/safe-area-chromium --runtime-dir=.tmp/issue825-ownership-runtime --skip-prepare --server-port=5252`. The occupied negative used a real independently launched FsusUI prepared preview returning HTTP200 on5252. The owner exited1 with EADDRINUSE before any browser report, and that preview stayed alive. The unchanged standalone config was run under CI=true with the external URL unset and also refused before tests (JSON stats zero/zero).

After removing that owned test preview, the same owner command bound one server on5252 and actually ran its two browser tests. Startup admission PASS; product tests1PASS/1FAIL at the existing Drawer landscape-notch close right819 vs safe right785; original whole-owner aggregate FAIL also retains seven stale-source receipt refusals. This is not an all-green boundary owner or a product waiver.

`issue825-ownership-controls.mjs` is the exact task-local harness, not a product fixture or acceptance replacement. Its positive test checks one readiness line, no duplicate/occupied-port failure, and creation of the original cell report. The actual report/contexts and original terminal logs are preserved under positive/ and alongside it. `exact-sha-regression.log` contains three real-process regression tests; `exact-sha-lint.log` is empty on success. `results.json` preserves statuses and unrun checks. The fresh b17077 default conflict check passed without conflicts.

No original negative control, config, golden, assertion, geometry, public API, CSP or dependency alias changed. No API content writes, PR head moves, merges or package publication. Return this correction and the sibling recorded52 archive to reviewer01a11a17-421e-749d-bc51-7aecfd74c01b through the existing coordinator.
