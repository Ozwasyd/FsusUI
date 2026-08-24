# Visual Change Workflow

> **Role:** Normative implementation and review workflow
> **Applies to:** FsusUI component/theme/motion/layout changes and visual changes in applications that consume FsusUI
> **Authority:** Executes the contracts in `spec/`, `docs/design.md`, domain documentation, and consumer rules. It cannot redefine them or claim shared orchestration authority.

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

## 3. Classify the FsusUI domain decision

Before editing, produce a machine-validated:

`fsusui-design-conformance.ui-ux-classification-receipt.v2`

Record:

- owner repository and affected surface;
- public behavior and visual states affected;
- files and adjacent areas explicitly out of scope;
- whether the change alters design intent or only restores conformance;
- `uiDecisionClass`: `prescribed`, `bounded-composition`, `layout-judgment`, `interaction-judgment`, or `system-design-dispute`;
- `verificationClass`: `ux-local`, `ux-path`, or `ux-system`;
- exact Skill, design-authority, active-baseline, candidate, and classification-evidence digests;
- `domainPolicyDigest`.

If the requested effect would require reclassifying the surface, adding a new token, or changing design intent, stop treating it as a local styling fix and follow the design-contract change process.

This classification is a repository/domain fact. It does not select an actor, model, profile, route, lease, retry path, checkpoint policy, or scheduler stage.

## 4. Inspect before changing

- Render and inspect the current state before changing observable output.
- Use realistic content rather than placeholder-only data.
- Check existing component, fixture, and consumer usage before adding a primitive.
- Identify the actual failure: hierarchy, composition, component defect, token drift, interaction, accessibility, platform difference, or consumer override.

Do not infer a visual problem solely from source code when rendered evidence is available.

## 5. Preserve ownership boundaries

Implementation must not rewrite frozen tests, fixtures, snapshots, acceptance mappings, design authorities, or the design Skill merely to make a candidate pass.

UX acceptance and system-design adjudication are evidence-producing decisions. Their receipts must not include implementation modifications.

"Implementation, tests, fixtures, and documentation are all required for a complete issue" does not mean one execution context owns every path. The repository boundary is semantic: each artifact must remain owned by the source of truth that defines it.

How a shared scheduler enforces those boundaries is external to FsusUI.

## 6. Implement the smallest coherent fix

- Change the owning source only.
- Reuse canonical tokens and public primitives.
- Preserve information architecture and adjacent visual behavior unless explicitly in scope.
- Keep all states needed for one user-observable behavior coherent.
- Do not add a consumer compatibility layer for an FsusUI defect.
- Do not weaken tests, thresholds, or checkers to accept the new output.
- Do not update snapshots or fixture expectations instead of fixing implementation.

If the work is too broad to remain coherent, report the domain boundaries that need to be separated. Work slicing, dispatch, continuation, and checkpoint mechanics belong to an external orchestrator when one is present.

## 7. Resolve system-design disputes

`system-design-dispute` means the design or ownership fact is unresolved and implementation must not proceed on an assumption.

Produce a valid:

`fsusui-design-conformance.ui-system-adjudication-receipt.v2`

The receipt binds:

- the classification receipt;
- owner repository;
- Skill and authority digests;
- active FsusUI baseline;
- candidate identity;
- problem classification;
- disposition;
- allowed post-adjudication `uiDecisionClass`;
- in-scope and out-of-scope boundaries;
- any required consumer or library follow-up issue;
- `domainPolicyDigest`.

The adjudication receipt determines design/ownership facts only. It cannot choose model/profile/effort, define an execution route, set runtime permissions, prescribe leases, choose retries, or control scheduler order.

It cannot include implementation modifications.

## 8. Select repository-local verification by impact

Use repository-defined commands rather than inventing a parallel test path.

For FsusUI rendered changes, start with the applicable checks from:

```bash
pnpm run check:design-source-drift
pnpm run check:anti-ai-visual
pnpm run tokens:check
pnpm run tokens:lint
pnpm run verify:visual:affected
```

Add focused type, unit, interaction, accessibility, motion, platform, package, or consumer checks according to [`docs/design/change-classification.md`](../design/change-classification.md). Global token, typography, foundation, public-shell, or other `full-required` changes must follow the recommendation emitted by the visual planner.

For a consumer, use its own tests and screenshot matrix while preserving the FsusUI baseline and public-contract checks.

These commands are repository acceptance facts. They do not prescribe which model or actor executes them.

## 9. Inspect rendered evidence

Inspect, rather than merely generate, the affected evidence:

- default and changed interaction states;
- light and dark themes;
- relevant desktop and mobile viewports;
- realistic short, long, empty, loading, error, and permission content;
- supported locales and text expansion;
- keyboard focus;
- touch;
- screen reader behavior;
- zoom and overflow;
- reduced motion;
- Web/Avalonia or consumer comparisons when cross-platform or downstream behavior changes.

Use production fixtures and record every inspected artifact, not only the generation command. Each applicable viewport/state/theme/input entry must bind evidence rather than rely on narration.

A zero visual diff proves only that covered baselines did not change. It does not prove a new state that lacks a fixture.

## 10. Verify UX independently

Produce a valid:

`fsusui-design-conformance.ux-acceptance-receipt.v2`

The receipt is bound to:

- the frozen classification;
- candidate identity;
- `verificationClass`;
- Skill and authority digests;
- active baseline;
- `domainPolicyDigest`;
- independence evidence;
- the viewport/state/theme/input matrix;
- inspected production rendered artifacts;
- blockers;
- acceptance status.

An accepted receipt has no blockers. A rejected receipt has at least one blocker. The receipt must not include implementation modifications.

The UX receipt intentionally contains no actor name, model/profile/effort, route, sandbox, work plan, prompt, checkpoint, retry, or scheduler state. A shared scheduler may add its own execution receipts outside this FsusUI contract.

Documentation that claims conformance must not be finalized until the required behavior and UX evidence exists, but FsusUI does not prescribe the scheduler stage sequence used to obtain that evidence.

## 11. Review against the design contract

Reject or revise the change when it:

- creates a parallel design rule or unregistered value;
- increases focal points without a product requirement;
- adds surfaces, cards, badges, icons, copy, motion, or decoration to fill space;
- uses a consumer override to mask an FsusUI defect;
- moves product-specific composition into FsusUI;
- obtains an effect by misclassifying a surface;
- passes only because a checker, threshold, or baseline was weakened;
- looks correct only with placeholder content or one viewport.

## 12. Shared orchestration authority boundary

FsusUI owns design, product, component, consumer, and acceptance semantics. It does not own shared orchestration authority.

A scheduler/orchestrator exclusively owns:

```text
root/controller behavior
permanent actor roster and stage-role mapping
model/profile/effort selection
route selection
runtime execution and permission classes
lease/resource/capacity
shared stage order
checkpoint/continuation
retry/recovery/failure routing
delivery/cleanup/terminalization
```

Do not add these decisions to this workflow, the Skill, or FsusUI machine contracts.

## 13. Completion evidence

Report:

1. baseline revision and ownership classification;
2. files changed and design sections applied;
3. public contracts, tokens, states, and consumers affected;
4. commands run and exact results;
5. viewports, themes, locales, states, and platforms inspected;
6. screenshots, traces, reports, or failure evidence produced;
7. remaining uncertainty and any verification not completed;
8. confirmation that no parallel design system or compatibility layer was introduced;
9. confirmation that FsusUI domain evidence did not claim shared orchestration authority.

Do not claim visual acceptance when rendered evidence was not inspected.
