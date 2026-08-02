# Visual Change Workflow

> **Role:** Normative implementation and review workflow
> **Applies to:** FsusUI component/theme/motion/layout changes and visual changes in applications that consume FsusUI
> **Authority:** Executes the contracts in `spec/`, `docs/design.md`, domain documentation, and consumer rules. It cannot redefine them.

Use this workflow whenever rendered output, interaction states, visual geometry, theme behavior, motion, icons, responsive layout, documentation examples, or consumer composition changes.

## 1. Establish the baseline

- Record the repository and revision being changed.
- For a consumer, record the exact FsusUI revision, package version, workspace alias, or linked checkout.
- Identify the affected component, route, fixture, platform, and existing visual evidence.
- Do not evaluate a consumer against one FsusUI revision and implement against another.

## 2. Read the owning contracts

Read only the relevant sources, but always include:

1. [`docs/design.md`](../design.md)
2. [`docs/design/governance.md`](../design/governance.md)
3. [`docs/design/change-classification.md`](../design/change-classification.md)
4. the nearest token, component, UX, API, or platform contract
5. [`docs/consumers/design-integration.md`](../consumers/design-integration.md) for downstream products

Do not substitute a Skill summary, issue description, screenshot, or model preference for these sources.

## 3. Classify and state the allowed change

Before editing, produce a machine-validated
`fsusui-design-conformance.ui-ux-classification-receipt.v1` and record:

- owner: specification, FsusUI Web/Vue, FsusUI Avalonia, platform override, or consumer;
- surface and role;
- public behavior and visual states affected;
- files and adjacent areas explicitly out of scope;
- whether the change alters design intent or only restores conformance.
- `uiDecisionClass`: prescribed, bounded composition, layout judgment,
  interaction judgment, or system design dispute;
- `verificationClass`: UX local, path, or system;
- current Skill, design-authority, baseline, routing-policy, slice-policy, and
  classification-evidence digests.
- candidate SHA and candidate identity digest.

If the requested effect would require reclassifying the surface, adding a new token, or changing design intent, stop treating it as a local styling fix and follow the design-contract change process.

The shared DAG proposal/validator freezes this receipt. A scheduler cannot
rewrite it or hand-select a model.

## 4. Freeze a coherent executable slice

Every UI writer dispatch must bind immutable work-plan, executable-slice,
compiled-prompt, checkpoint-policy, execution-route, implementation-run
identity, Skill, authority, baseline, classification, and candidate digests.

The dispatch must also bind the actual Sol model/effort, exact target worktree
and worktree digest, and candidate SHA. A requested or selected profile is not
runtime evidence.

The slice and prompt must state:

- one coherent user-observable objective;
- first required edit or render-inspection action;
- first read targets and first writable component/demo path;
- state and viewport subset;
- required implementation files, focused commands, and render probes;
- explicit non-goals;
- checkpoint thresholds;
- completion and continuation predicates.

Do not submit an entire component family, unrelated interactions,
design-system governance, and all rendered states as one slice. Do not split
one behavior's necessary visual, interaction, state, or responsive support into
non-runnable fragments.

## 5. Inspect before changing

- Render and inspect the current state before changing observable output.
- Use realistic content rather than placeholder-only data.
- Check existing component, fixture, and consumer usage before adding a primitive.
- Identify the actual failure: hierarchy, composition, component defect, token drift, interaction, accessibility, platform difference, or consumer override.

Do not infer a visual problem solely from source code when rendered evidence is available.

## 6. Separate roles and write leases

The versioned role/profile/permission contract is
[`ui-stage-policy.json`](../../.agents/skills/fsusui-design-conformance/contracts/ui-stage-policy.json).

The ordered writer leases are:

```text
test owner -> UI/UX implementer -> documentation writer
```

- Test owner writes tests, fixtures, probes, mutation controls, and acceptance
  mapping only.
- UI/UX implementer is the only UI and UX implementation owner and writes
  implementation paths only.
- Documentation writer starts only after behavior green and UX accepted and
  writes documentation only.
- Behavior verifier, UI system adjudicator, and UX acceptance verifier are
  fresh and read-only/read-execute.

No implementer may alter frozen tests, fixture expectations, snapshots,
thresholds, acceptance mappings, design authorities, or the design Skill.
“Implementation, tests, fixtures, and documentation together” means that one
issue and candidate closes all four responsibilities before delivery; it does
not authorize one agent or one lease to edit all four.

## 7. Route UI implementation deterministically

```text
prescribed/bounded + atomic or bounded multifile -> Sol/low
layout/interaction + bounded multifile or iterative debug -> Sol/medium
bounded render-probe-heavy -> Sol/medium
context-heavy/high-tool-depth/long-horizon -> stop and re-slice
system design dispute -> stop and fresh read-only adjudication
```

Ordinary code agents, Luna, Terra, and Sol high/xhigh/max cannot implement
user-observable UI. Failure count, output-missing, UX rejection, cost, model
self-report, or scheduler preference cannot promote the implementation route.

## 8. Implement the smallest coherent fix

- Change the owning source only.
- Reuse canonical tokens and public primitives.
- Preserve information architecture and adjacent visual behavior unless explicitly in scope.
- Complete the current implementation slice without modifying assets owned by
  another lease.
- Do not add a consumer compatibility layer for an FsusUI defect.
- Do not weaken tests, thresholds, or checkers to accept the new output.
- The implementer must not update snapshots or fixture expectations.

Within one rollout, the implementer executes the first action, edits the
current slice, runs frozen focused checks/render probes, diagnoses failures,
changes only authorized implementation, and reruns to the completion
predicate. Before investigation/no-artifact thresholds it must leave a
filesystem/Git/command-backed checkpoint or a terminal receipt.

A continuation binds the same slice and verified checkpoint, including the
next required action. A prose plan is not a checkpoint. Completing one slice
does not authorize candidate-green; all slices and the complete frozen stage
matrix must pass first.

## 9. Resolve system disputes

`system-design-dispute` stops implementation. A fresh read-only Sol high/xhigh
adjudicator emits a valid
`fsusui-design-conformance.ui-system-adjudication-receipt.v1`.

The receipt binds owner, classification, Skill and authority digests, baseline,
candidate SHA/digest, actual profile, scope, allowed Sol low/medium
implementation class, required consumer/library issue, routing/slice policies,
and required re-slicing. The adjudicator cannot edit code, redesign, expand
scope, or sign UX acceptance.

## 10. Select verification by impact

Use the repository-defined commands rather than inventing a parallel test path.

For FsusUI rendered changes, start with:

```bash
pnpm run check:design-source-drift
pnpm run check:anti-ai-visual
pnpm run tokens:check
pnpm run tokens:lint
pnpm run verify:visual:affected
```

Add focused type, unit, interaction, accessibility, motion, platform, package, or consumer checks according to [`docs/design/change-classification.md`](../design/change-classification.md). Global token, typography, foundation, public-shell, or other `full-required` changes must follow the recommendation emitted by the visual planner.

For a consumer, use its own tests and screenshot matrix while preserving the FsusUI baseline and public-contract checks.

## 11. Inspect rendered evidence

Inspect, rather than merely generate, the affected evidence:

- default and changed interaction states;
- light and dark themes;
- relevant desktop and mobile viewports;
- realistic short, long, empty, loading, error, and permission content;
- supported locales and text expansion;
- keyboard focus, touch, screen-reader behavior, zoom, overflow, and reduced
  motion when applicable;
- Web/Avalonia or consumer comparisons when cross-platform or downstream behavior changes.

Use production fixtures and record every inspected artifact, not only the
generation command. Each applicable viewport/state/theme/input entry must bind
evidence rather than rely on narration.

A zero visual diff proves only that covered baselines did not change. It does not prove a new state that lacks a fixture.

## 12. Verify behavior and UX independently

Candidate-green enters a fresh behavior verifier. Its self-test receipt cannot
replace independent behavior evidence.

After behavior green, a fresh read-only UX verifier uses:

```text
ux-local -> Sol/medium
ux-path -> Sol/high
ux-system -> Sol/xhigh
```

It emits a valid `fsusui-design-conformance.ux-acceptance-receipt.v1` bound to
the candidate, classification, dispatch, actual profile, Skill, authorities,
baseline, work plan, slices, prompt, route, viewport/state matrix, inspected
production rendered artifacts, blockers, status, and digest. An accepted
receipt has no blockers. A rejected verifier has veto authority but cannot
modify or redesign.

The acceptance receipt binds distinct implementation-run and verifier-run
identity digests. Equal identities fail closed even if the receipt claims a
fresh context.

Documentation cannot start before behavior green and candidate-matching UX
accepted. Each acceptance-group member repeats classification, slicing,
routing, baseline selection, candidate, and fresh receipts independently.

## 13. Recover output-missing

Classify missing writer output as slice/prompt non-executable, runtime
invocation failure, sandbox/cwd/worktree mismatch, first action not executed,
or verified profile-capability mismatch. Do not retry by changing only the
agent, attempt ID, wording, worktree, slice ID, or model.

A retry requires a material re-slice, runtime/permission repair, or verified
profile-capability mismatch with breaker-reset authority. A partial checkpoint
cannot satisfy test-contract frozen, candidate-green, behavior-green, UX
accepted, or documentation complete.

## 14. Review against the design contract

Reject or revise the change when it:

- creates a parallel design rule or unregistered value;
- increases focal points without a product requirement;
- adds surfaces, cards, badges, icons, copy, motion, or decoration to fill space;
- uses a consumer override to mask an FsusUI defect;
- moves product-specific composition into FsusUI;
- obtains an effect by misclassifying a surface;
- passes only because a checker, threshold, or baseline was weakened;
- looks correct only with placeholder content or one viewport.

## 15. Completion evidence

Report:

1. baseline revision and ownership classification;
2. files changed and design sections applied;
3. public contracts, tokens, states, and consumers affected;
4. commands run and exact results;
5. viewports, themes, locales, states, and platforms inspected;
6. screenshots, traces, reports, or failure evidence produced;
7. remaining uncertainty and any verification not completed;
8. confirmation that no parallel design system or compatibility layer was introduced.

Do not claim visual acceptance when rendered evidence was not inspected.
