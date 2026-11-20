# Web Markdown cold-render diagnosis, not formal CI

This isolated workflow runs only on the diagnostic branch
`codex/fsusui-web-markdown-cold-diagnostic`. It uses the exact #1145 product
trees: baseline f2d929a and PR candidate 358770e (tree 2142d45, identical to
measured merge commit 0a68d88f), the authentic preserved #1145 candidate driver
as the common driver, Chromium 147.0.7727.15 with sandbox, Node 22.23.5 and
pnpm 10.33.0. Formal workflows, thresholds and product source are not changed.

The fixture is Markdown 24,576 UTF-16 code units at DPR1 / 60Hz / motion enabled,
with a fresh product server and browser process per arm. Measure independent
navigation-to-ready and document-init-to-ready once per arm. A passive
document-init observer timestamps the first exact Markdown fixture ready
marker, which is set by the fixture's render-complete handler; it captures the
same-page phase probe at that moment and fails if it did not observe the WASM
renderer. These are page/fixture signals, not isolated parser microbenchmarks.
Parse reporting can be the fixture's observed WASM profile or worker-compute
fallback. Parse/transfer/commit overlap; do not add them as a total.

After that capture, execute the original 1 warmup and 21 actions, retaining all
action and next-rAF samples as a separate control. The 4 AB and 4 AA blocks
each run four fresh arms with equally balanced direction; neither individual
frames nor arms are dropped. Cold timing has one observation per fresh arm.
The diagnostic-only report gives per-block ratios separately for both cold
measurements and the post-ready control, not a replacement gate or p-value.

Run the exact workflow to set up dependencies. For local dry preparation,
invoke `python3 run.py --help` for arguments and use `--prepare-only`; that
checks both Git identities and generated JS syntax without launching.
