# #1147 fixed-list and table frame diagnostic (not a gate)

The source is the effective driver and binding archived in Quality Gates #1147 (run 44667076461). The controller checks both digests and retains the original archived candidate SHA. GitHub's synthetic merge 340712f and PR head 85ac427 have the same tree 302622ae; the workflow uses the reachable exact head and its own honest identity. Historical product is f2d929a.

Run only the exact 100,000-row fixed list (DPR 1, motion enabled) and table pipeline (DPR 2, reduced motion), in that order, with pinned Chromium 147.0.7727.15, Chromium sandbox enabled, Node 22.23.5, 60 Hz idle calibration, one warmup and 21 samples. Original action, browser trace categories, worker probes and table legacy-sort/worker probe are unchanged. The narrowed scenario set does not preserve cross-scenario heat from the other 11 formal rows.

One job runs four randomized, predeclared AB blocks and four same-version AA blocks. Each has four distinct browser process starts, alternates crossover orientation, and aborts on missing or wrongly ordered arms or mixed CPU/OS/toolchain identity. Checks do not require the exact same CPU model as #1147 because the hosted scheduler controls its allocation; all arms must be on the same current runner.

Per sample, record original action start/finish and next callback plus the last rAF callback timestamp at both action boundaries, and the preceding table auxiliary probe completion on the same browser clock. The phase measurements locate a shift before versus after action completion; they do not prove a browser subsystem bug or establish physical presentation time. The 26 ms synchronous auxiliary table probe runs between primary samples and may affect the next submission phase; it is deliberately not removed. Both raw arrays remain intact. Output includes per-block geometric P95 ratios, AA spread and paired phase differences. It never produces formal acceptance or changes the 15% gate.

Run local available source/negative controls from this directory with `python3 -m unittest -v`. Hosted runtime has not run at authoring time.
