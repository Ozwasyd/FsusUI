# Canonical825 touch sibling-contract replay — independent review HOLD

qualificationEligible=false. Original825 supplied exact test-only commit8fe088d906eb08407334e274cff7e1ba43523fd6 on fix/issue-825-touch-sibling-contract. It was fetched and its remote ref independently verified. Root inspected the actual diff and replayed the original test file in a fresh detached checkout of EXACT8fe. No alternative test, producer, product source, timeout, retry, snapshot or assertion edits. UI856 remains HOLD until the separately appointed independent reviewer concludes. A passing replay does not approve the test change or replace any old failure.

## Candidate and scope

8fe changes only vue/tests/markdown-editor/markdown-editor-paste-markdown.spec.ts relative to its parent657d7652342ba53735324bb512e4fe806efad8a1. Relative to canonical corrected825 candidate5fb35c3b6fa8bc96661e55e5cf4ad5e9142d9cfc, the full8fe tree also inherits accepted-maina96047c3a281df6f0ae035f27fc471ad4a645173 Dialog/FocusTrap826 changes plus staging/API metadata. This replay is bound to full8fe, not incorrectly labeled pure5fb. MarkdownEditor.vue, markdown-editor.scss, original toolbar-geometry spec and Playwright config are byte-identical to5fb. Latest main fetched before work remaineda96047c3. Source and test worktree /workspace/FsusUI-825-touch-8fe-replay stays detached/clean before and after original setup and browser execution.

Existing component documentation explicitly defines overflow as a normal-flow sibling of the horizontal primary scroller. 8fe changes the closest-container lookup from .el-markdown-editor__commands to the common .el-markdown-editor__command-group, independently queries the primary scroller, and additionally asserts shared parent plus primaryRect.right<=targetRect.left. It retains real DOM bounding boxes, group/viewport intersection, scrollLeft0, real horizontal overflow, target and visible width/height>=44px, and direct elementFromPoint hit ownership. It retains expanded-trigger alpha==1, three hit-stack samples, visible tray/entry, entry width/rounded-height>=44px, actual taps, import-dialog result and textarea focus. Seventeen existing predicate/interaction markers remain present; this marker inspection is supporting evidence, not a formal semantic equivalence proof.

The change expands the original touch test into separate light/dark tests, each preserving390x844 and320x640, with resolved-theme assertion and an original testInfo geometry attachment. Existing tests receive unchanged default openFixture behavior. The existing issue395 conditional-evidence suffix is byte-identical to the parent: FSUS_MARKDOWN_IMPORT_EVIDENCE must equal1 and browser must be Chromium. No new skip, retry, negative-control removal or timeout relaxation. This inspection is consistent with the documented sibling intent, but independent acceptance/adjudication remains pending. Root does not issue the independent-review verdict.

## Actual command, result and environment

AGENTS.md, current visual-testing instructions, existing conformance skill boundaries, nearest component contract and original Playwright config were read. The frontend-testing-debugging skill was used. Browser plugin not available; the delegated request explicitly permits original repository Playwright. Flow: transaction fixture -> touch overflow -> paste-as-Markdown dialog -> import -> exact source value plus textarea focus. Node24.19/pnpm10.33, configured managed Chromium and browser libs. Original fresh frozen install and original ensure:icons, ensure:wasm and build:theme each exit0. These producers were executed unchanged; no competing producer edits or package publication.

```sh
source /workspace/.setup/activate.sh
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.setup/playwright-browsers
export LD_LIBRARY_PATH=/workspace/.setup/browser-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
export FSUS_MARKDOWN_EDITOR_PORT=5341 CI=1 FSUS_VISUAL_EVIDENCE=1
pnpm exec playwright test --config=vue/playwright.markdown-editor.config.ts --project=chromium --trace=on --output=/tmp/2228-825-touch-8fe-browser-first vue/tests/markdown-editor/markdown-editor-paste-markdown.spec.ts
```

Original config starts its own production build:demo+vite preview with strict port5341; CI=1 refuses unrelated server reuse. Actual terminal exit0:9passed/1existing conditional skipped of10,59.4s. Root selected only this original paste file. Owner-reported21passes/1skip is not reproduced or relabeled as this10-test selection. No whole63/64-test production-project, WebKit, real iOS, Blog runtime, package parity, UX/system acceptance or0warning qualification claim.

| QA check | Actual evidence |
| --- | --- |
| Page identity | Original touch traces show http://127.0.0.1:5341/?audit=ui-states&markdownEditorTransaction=1&theme=light/dark. Resolved theme is actually asserted. Title is not separately asserted. |
| Meaningful rendered content | Original fixture visibility, live commands, dialog, import and exact textarea value pass. |
| Framework overlay | Existing openFixture assertion requires zero vite-error-overlay elements. |
| Console health | All10 original trace outputs inspected;0console warning/error events found. This bounded observation is not a full release0warnings receipt. |
| Rendered screenshots | Extracted final320x640 after-import frames for both themes; root inspected dark frame with bounded sibling button, imported Markdown and textarea focus ring. |
| Interaction | Both themes and both viewport sizes execute actual touch trigger/entry/import, exact source value and focus assertions. |

Actual original geometry attachments for all four theme/viewport pairs: siblingLayout=true, directlyTappable=true, scrollLeft0, primary scrollWidth388; primary clientWidth200 at390x844 or130 at320x640. Trigger width112/height44, visible width112/height44. Full trigger was visible in these actual observations; no mock geometry/CSS injection or locally changed fixtures. Expanded background/hit-stack and import/focus requirements pass in original tests. Attachments, original10traces including the skipped attempt, both final frames and raw command logs retained separately.

## Preserved first failures and current gates

Frozen source-consumption branch prior headbdb4126b852a03db3d387c3396f4129f08806405 and its corrected-825-comparison artifact manifest remain unchanged. Root independently reverified all23 prior custody entries against both immutable Gitbdb and disk before this replay. Original9dad full63 production run remains60pass/2fail/1conditional skip. Original unchanged touch failure at paste-markdown.spec.ts440 and corrected6ddb first unchanged touch failure are still preserved. This replay does not rewrite them or mark their acceptance gate resolved while UI856 independent review remains HOLD.

Read-only UI856 observation: open/draft/unmerged, head657d7652342ba53735324bb512e4fe806efad8a1, basea96047c3. The tested8fe exists on the separate supplied branch; UI856 head is not silently claimed to contain it. No PR/comment/issue mutation attempted under central content-write coordination.

Lifecycle finding remains separate. Original full9dad run timed out the20s retainedResources==0 predicate at markdown-heavy-feature-lifecycle.spec.ts404; every27 recorded resource read was0, last page evaluation19.819s. Separately run unchanged frozenf7 minimal case passed1/1 in6.4m with Slow Test warning. This is an actual timing/performance/renderer-scheduler authority gap requiring current canonical641/640 owner investigation, not a proved leak and not PublicShell828 scope. No guessed lifecycle fix, copied sibling implementation, retry, timeout extension or resource-budget weakening.

Blog2228 evidence-only remains blocked by actual admitted DebugStack/ReleasePreview/fixtures/current inventory/native required Chromium+WebKit/live HTML+surface receipts;2229 by same-candidate automatic receipt and genuine iOS17+ continuous device/verifier evidence;1789 continues to aggregate all applicable gates.3477 existing merged reconciliation stays closed with prior exact currentmaster3466 original3surface/4mutation pass. UI828 budget/UX/full-test gates stay open. Closed upstream status, component-local success, owner-reported passes and static source do not substitute for current consumer/runtime/device qualification.

No source integration of8fe into root's published support candidate was performed pending independent review. Rollback this report-only increment independently; detached replay has no local source changes. No direct-master push, merge/auto-merge, deployment, package publication, fabricated event1984/receipt or security bypass. Parent has the canonical commit, measured replay and exact artifacts for its independent review; all content API writes remain reserved for its central slot.
