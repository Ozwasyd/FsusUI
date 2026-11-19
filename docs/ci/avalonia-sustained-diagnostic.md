# Avalonia sustained-scrolling CI diagnostic

This opt-in diagnostic uses the existing controller and measurement protocol. It does not change the formal matrix, thresholds, workload, renderer selection, SDK policy, or runtime. Do not substitute its output for the full quick matrix or a paired acceptance result.

## Run on the same hosted environment

Use the same job image, pinned SDK, installed runtime, fonts, environment, display configuration and checked-out controller as the formal run. Do not add a forced backend or tune GC/runtime settings. Run sequentially, never alongside another benchmark.

```sh
FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL=variable-list-layout-ready.v1 \
node scripts/run-render-performance.mjs \
  --avalonia-only --profile quick \
  --scenario virtual-list-variable-100k-sustained \
  --warmups 1 --samples 21 --long-scroll-iterations 256 \
  --output /absolute/fresh-diagnostic-directory
```

Each invocation builds the actual Demo and launches a fresh application process. The exact sustained selector produces one scenario; the shorter `virtual-list-variable-100k` selector deliberately produces both remount and sustained scenarios and is **not** an isolated sustained control. Do not pass the formal impact plan: its scenario selection takes precedence.

To measure the immutable supported historical product with the same controller, add `--product-root /absolute/clean-f2d-checkout`. The existing launcher validates its historical identity, substitutes only the measurement runner through the compile sidecar, and records source, assembly and output hashes. This direct diagnostic does not replace the outer historical acceptance wrapper.

## Distinguish predecessor effects

Compare the isolated output with the same product's existing full-quick output from the same hosted environment. The formal sustained case occurs after fixed list, remount variable list, table, data table, Tree, input and theme. The isolated case has none of that predecessor history. If a new prefix-preserving control is authorized, omit only `--scenario` and write to a different fresh directory; do not rewrite the formal plan or move scenarios.

Authorized prefix-preserving counterpart, in a fresh process and separate directory:

```sh
FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL=variable-list-layout-ready.v1 \
node scripts/run-render-performance.mjs \
  --avalonia-only --profile quick \
  --warmups 1 --samples 21 --long-scroll-iterations 256 \
  --output /absolute/fresh-prefix-diagnostic-directory
```

Read the exact `virtual-list-variable-100k-sustained` result in each summary and its corresponding raw file. Keep both outputs; report prefix versus isolated per product, not just a pooled cross-product number. For a baseline/candidate comparison, use the same controller for both and repeat the same two commands with the historical `--product-root` option. Do not compare a single-scenario diagnostic to the formal full-matrix comparator as if matrices matched.

Before interpretation verify identical `Environment` fields, product SHA, effective driver SHA, protocol, warmups, sample count and long-scroll count. Record any runtime or image differences rather than silently compensating. Preserve `measurement-layout-binding.json`, summary and raw files in a separately labeled diagnostic artifact. All compared artifacts must retain their original hashes.

A disappearance of aggregate Gen2 asymmetry supports a history-dependent explanation, but does not identify which predecessor caused it. Existing raw files contain collection totals, not per-frame suspension intervals. Causal phase attribution additionally requires a separately authorized symmetric GC trace with phase markers; do not infer pauses from totals, subtract guessed GC time, or change acceptance limits.
