# Public baseline input mismatch: consumption halted

The proposed four-file generated metadata increment was **not applied**. The current published implementation source remains `66d6b56fe6033b5bdca723346847f3deac7d5e40` on `integration/ui861-renderer-lint-20261009`.

The coordinator required genuine producer-input equality and instructed this worker to return the exact input on mismatch before consuming metadata. The original producer output is `18b03e8e81a6787bea5b5bf09d8177227ce61f5d`, whose exact parent and actual capture source are `3baff077297ad15a1d205eba8dc0bc525483ff88`. The [original producer evidence](https://github.com/Ozwasyd/FsusUI/blob/ec3e759602a27efcaa56ef3876e125d82f9e36aa/docs/releases/evidence/ui861-public-baseline-18b03/outcome.md) is a separate source receipt.

The producer observer recorded 1,600 input files. This read-only comparison matched 1,599. The one mismatch is `vue/packages/components/markdown-renderer/__tests__/markdown-renderer.test.tsx`:

| Input | SHA-256 | Bytes |
| --- | --- | ---: |
| Original observed input at `3baff077…` | `8a6fea1a68c3dd9acaff8cc2ff972bf35c8d82d05dc2c0f35cabdc7f35ebbb44` | 39,755 |
| Actual successor input at `66d6b56f…` | `d1806866629113a2ebfcbb24fa1fe90e66956a183488284111f249ac0fa4f3e7` | 39,710 |

The source delta from `3baff077…` to `66d6b56f…` is exactly the renderer test type-annotation fix consumed from owner `2bcaf5af7eb359dcdc316cb4acc85c27f10872b8`. The raw diff is retained here. It is a real source-byte change, regardless of separately established emitted-JavaScript equivalence. This worker does not silently remove that observed input or infer equivalence permission from baseline hashing exclusions.

All four generated-output preimage Git blobs match the original producer parent. All five installed tool versions and package JSON hashes match; Node `v24.19.0` and pnpm `10.33.0` match. The complete 1,600-entry comparison, original producer observations, tool identities and source provenance are retained as JSON.

Read-only reproduction from a native installation at source `66d6b56f…`:

```sh
python verify-observed-inputs.py /path/to/source66 producer-generation-observation.json
```

This command exits 1 with the exact single mismatch. It neither runs the producer nor edits the source. The separately retained command-results JSON records the source/preimage diff and conflict checks.

A fresh `git fetch --no-tags origin main` resolved main to `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`; `git merge-tree --write-tree` against source `66d6b56f…` exited 0. Source is clean. The distinct proposed successor branch `integration/ui861-complete-projections-20261009` is parked locally at unchanged source `66d6b56f…`, clean and unpushed.

Required next input: #827/coordinator must resolve the observed renderer test source difference through an actual source-specific producer receipt or explicit source-backed disposition. Until then the four generated files remain unapplied. No producer rewriting or blind copying of generated fingerprints occurred.

No baseline, contract or browser checks were executed in this mismatch step. Previous source `66d6b56f…` exact original CI637 and added pending-activation unit tests each passed 1 test with 36 unselected, and focused lint passed; those receipts remain in [their original evidence](https://github.com/Ozwasyd/FsusUI/blob/52941d9d86d16e1743b0be6228c204e2ab50a14a/review-evidence/ui861-renderer-lint-successor/README.md). Historical source `3baff077…` Chromium receipts remain associated with that SHA. No Chromium result is attributed to `66d6b56f…` or a new successor.

Firefox and WebKit remain unrun here. The previously attempted official dependency installation failed at root authentication; it was not retried. WebKit still lacks its seven recorded host libraries, and Firefox retains its recorded sandbox/cache limitations. Blog local-alias manage-write evidence remains owned by original2228 and OPEN. No package publication, GitHub issue/PR content write, default-branch push, or merge occurred. Draft PR handoff stays with the coordinator while its content queue is paused.

Changeset not needed: this commit contains read-only mismatch evidence and no implementation or public API change. Rollback is omission of this evidence commit; frozen implementation and review branches are unchanged.
