# Web CI measurement diagnostic

This opt-in tool measures only the large data-pipeline table (100,000 rows,
60 Hz, DPR 2, reduced motion). It does not change a quality gate, product
source, or the existing acceptance matrix. Compare the exact baseline and
candidate builds on one idle runner. Prepare the same pinned dependencies and
normal WASM artifacts for each clean product checkout. Use Chrome for Testing
147.0.7727.15 verified by the existing pin tool. Do not disable its sandbox, use
a different version, or run another benchmark alongside this one.

```sh
node scripts/run-web-ci-measurement.mjs \
  "$BASE_ROOT" "$BASE_SHA" "$CANDIDATE_ROOT" "$CANDIDATE_SHA" \
  "$PINNED_CHROME" "$NEW_DIAGNOSTIC_DIR" --pilot
```

The eight-process pilot verifies capture, but cannot establish a verdict.
Omit `--pilot` for the full 48-process calibration: six cycles each with
baseline/candidate in both orders and two same-version control pairs. Every
process uses 61 samples, verifies its own idle browser pacing and retains
full end-to-end samples including time waiting for the next frame. The
individual action and waiting percentiles are evidence, not replacements
for the end-to-end percentile or additive components of it.

The tool records source identities and compares the runner signature across
processes. A pacing mismatch, process failure, or runner identity change
interrupts capture and records `INCONCLUSIVE`; it is not retried or averaged
away. For complete captures, an exact median interval on paired process
P95 ratios is widened by the observed same-version drift. An interval spanning
the existing 15% threshold, or an order effect exceeding the observed noise,
is `INCONCLUSIVE`. The interval assumes independent process pairs; the
observed noise range is not a guarantee about future runner noise.

Keep the whole diagnostic directory, including original raw measurements,
per-process identities, plan, manifest and verdict. Set the runner job timeout
to accommodate the regular dependency setup plus at most 75 minutes of capture.
Do not import these diagnostic files into the formal comparator. Even diagnostic
`PASS` includes `formalAcceptance: false`. Changeset not needed: internal
benchmark tooling only.
