# Actual renderer lint source baseline projection

Source offer: `977b406a01b8dae24e434405e2892e55e1ff980c` on `fix/ui861-66-public-baseline-projection-20261009`, with actual parent and captured source `66d6b56fe6033b5bdca723346847f3deac7d5e40`.

The unchanged original `avalonia:baseline`, `component-contracts:generate`, and `contract-v2:generate` producers regenerated exactly four existing generated files. Only capture commit, input/output hashes, and downstream baseline hashes changed; API payload, members, classifications, rules and thresholds are unchanged. This is internal metadata: no changeset is needed.

The complete original 1,600-input binding was recomputed from actual bytes: 1,593 observed file reads and seven explicit producer/tool inputs. Exactly one input differs from historical 3b: the reviewed renderer test is now SHA-256 `d1806866629113a2ebfcbb24fa1fe90e66956a183488284111f249ac0fa4f3e7`, 39,710 bytes. The previous 39,755-byte `8a6fea1a…` test was not substituted. The five tool identities and all other inputs remain identical. The original producer already excludes test files from its `inputTreeHash`; that rule was preserved and the complete observed binding still includes this test. The naturally unchanged input hash is not evidence that the test bytes match.

Actual results: baseline precheck FAIL because the old generated capture was stale; original regeneration PASS; all three second generations byte-identical PASS; baseline/v1/v2 checks PASS both before and after committing; 49 contract-v2 tests PASS; update-surface and documentation checks PASS. Fresh main `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71` merge-tree PASS. See the raw logs, fixed-point, payload-parity and input-binding receipts.

This offer is independent of the four-component npm candidate. It does not rerun or qualify browser, renderer, Avalonia/native, package, or Drawer acceptance. Historical 637-test evidence belongs to source 7087, not 3b; the original 3b unit receipt selected pending-activation. No old runtime receipt is rebound to 977. The prior 18b/3b branches and records are preserved. The real alias remains owned by its existing integration controller.

Root creates the draft PR and any issue comments; no package publication or merge was performed. To roll back, omit this isolated offer or revert its four-file metadata commit.
