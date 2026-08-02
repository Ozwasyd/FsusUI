---
name: fsusui-design-conformance
description: Use for implementing, reviewing, or documenting visual, UX, theme, token, motion, icon, component, responsive-layout, or rendered-output changes in FsusUI itself or in a repository that imports, aliases, wraps, or embeds FsusUI. Do not use for generic UI work, backend-only changes, or products that do not consume FsusUI.
---

# FsusUI Design Conformance Workflow

Use this Skill only when the change belongs to FsusUI or a confirmed FsusUI consumer. Its job is to route work through the repository’s design contracts and evidence workflow. It must not create, summarize into, or replace the design system.

This Skill owns FsusUI-specific UI/UX classification, implementation boundaries,
rendered-evidence requirements, and acceptance semantics. A shared scheduler may
carry its digests, but it must not reinterpret or duplicate these facts.

Machine-readable contracts live under
`contracts/`. `contracts/ui-stage-policy.json` is the versioned FsusUI UI stage
policy; the three adjacent JSON Schemas define classification, adjudication, and
UX-acceptance receipts. Validate them with:

```bash
pnpm run check:fsusui-design-conformance
```

## 1. Confirm scope and baseline

Confirm one of these conditions before proceeding:

- the current repository is FsusUI;
- the current repository imports FsusUI through a package, workspace, alias, linked checkout, or embedded source;
- the task explicitly reviews a consumer against a known FsusUI baseline.

Otherwise, do not use this Skill.

For a consumer, locate the exact FsusUI package version, revision, alias target, or linked checkout. Do not assume the consumer’s local copies of token values or design notes are authoritative.

## 2. Load the authoritative documents

Read, in order:

1. `docs/index.md`
2. `docs/design.md`
3. `docs/design/governance.md`
4. `docs/design/change-classification.md`
5. `docs/workflows/visual-change.md`
6. `docs/consumers/design-integration.md` when a consumer is involved
7. the nearest component, theme, UX, API, accessibility, motion, or platform contract

When working in a consumer repository, read these files from the linked FsusUI source or exact dependency baseline when available. Do not copy their values into the consumer or this Skill.

If this Skill conflicts with `spec/`, `docs/design.md`, or a public domain contract, the authoritative document wins. Correct the Skill or lower-authority document rather than reinterpret the design contract.

Loading must be observable. A dispatch receipt must bind the exact Skill digest,
authority digests, baseline repository/revision, and dirty fingerprint. Natural
language saying that the Skill was read is not evidence of effective load.

## 3. Freeze machine-readable classification before editing

Produce a valid
`fsusui-design-conformance.ui-ux-classification-receipt.v1`. It records:

- owner repository and affected surfaces;
- `uiDecisionClass`: `prescribed`, `bounded-composition`,
  `layout-judgment`, `interaction-judgment`, or
  `system-design-dispute`;
- `verificationClass`: `ux-local`, `ux-path`, or `ux-system`;
- required authorities and their digests;
- the active FsusUI baseline identity;
- the candidate SHA and candidate identity digest;
- state/evidence matrix and explicit in-scope/out-of-scope boundaries;
- classification, routing-policy, slice-policy, and receipt digests.

Do not choose a classification to obtain a desired visual effect. Do not classify an ordinary surface as expressive or glass, and do not move consumer composition into FsusUI.

The shared DAG proposal/validator freezes classification. Root cannot edit it or
select a different profile.

## 4. Require one executable UI slice

Every UI writer dispatch must bind immutable digests for:

```text
classification receipt
stage work plan
executable slice
compiled prompt
checkpoint policy
execution route
implementation run identity
Skill
design authorities
active baseline
candidate
```

The current slice must provide one coherent user-observable objective, first
required action, first read targets, first writable component/demo path,
state/viewport subset, required implementation files, focused commands/render
probes, explicit non-goals, checkpoint thresholds, and completion/continuation
predicates.

The dispatch also records the actual `gpt-5.6-sol` effort, exact target
worktree, target-worktree digest, implementation-run identity digest, and
candidate SHA. A selected profile without matching observable runtime identity
is invalid.

Do not dispatch a complete component family, unrelated interaction paths,
design-system governance, and the full render matrix as one slice. Do not split
the states, interaction, visual support, or responsive behavior needed for one
observable behavior into non-runnable fragments.

## 5. Enforce role, model, and lease boundaries

Use `contracts/ui-stage-policy.json`; no role may choose or promote itself.

- Root scheduler is `luna-low`. It compiles and validates machine artifacts,
  dispatches, and manages resources; it does not write tests, implementation,
  design facts, UX acceptance, or documentation.
- Test owner uses `sol-high | terra-max | sol-xhigh`. It alone writes frozen
  tests, fixtures, probes, mutation controls, and acceptance mappings.
- UI/UX implementer is the single UI and UX implementation owner. It uses
  `sol-low` for prescribed/bounded work and `sol-medium` for
  layout/interaction judgment, and writes implementation paths only.
- Behavior verifier uses the test-owner pool in a fresh read-only/read-execute
  context and cannot inherit the implementer conversation.
- UI system adjudicator uses `sol-high | sol-xhigh`, fresh and read-only.
- UX acceptance verifier uses `sol-medium`, `sol-high`, or `sol-xhigh` for
  local, path, or system acceptance respectively, fresh and read-only.
- Documentation writer uses `luna-high | luna-max` after behavior green and UX
  accepted, and writes documentation only.

Write leases are ordered and mutually exclusive:

```text
test owner -> UI/UX implementer -> documentation writer
```

Behavior verification, adjudication, and UX acceptance never receive write
leases. An implementer must not modify tests, fixture expectations, snapshots,
thresholds, acceptance mapping, this Skill, or design authorities.

## 6. Route by UI decision and execution shape

```text
prescribed + atomic-edit|bounded-multifile -> sol-low
bounded-composition + atomic-edit|bounded-multifile -> sol-low
layout/interaction + bounded-multifile|iterative-debug -> sol-medium
bounded render-probe-heavy -> sol-medium
context-heavy|high-tool-depth|long-horizon-cross-module -> stop and re-slice
system-design-dispute -> stop and read-only adjudication
```

Luna, Terra, ordinary code agents, and Sol high/xhigh/max must not implement
user-observable UI. Output-missing, test failure, UX rejection, model
self-report, balance, or failure count never authorizes promotion.

## 7. Implement and self-test one slice

Within one implementation rollout:

```text
execute first required action
-> implement the coherent slice
-> run frozen focused checks and render probes
-> diagnose failures
-> modify only authorized implementation
-> produce a verified artifact/checkpoint before thresholds
-> rerun to the slice completion predicate
-> emit slice terminal or continuation receipt
```

A continuation binds the same slice, checkpoint digest, real filesystem/Git/
command evidence, and `nextRequiredAction`. A narrative plan without paths,
commands, and digests is not a checkpoint. Completion of one slice is not
candidate-green. Only all implementation slices plus the complete frozen stage
matrix can produce a verified self-test receipt and candidate-green.

Allowed writer outcomes are:

```text
slice-terminal
slice-continuation-required
candidate-green
test-contract-disputed
ui-system-design-disputed
external-blocked
resource-failed
```

## 8. Adjudicate system disputes without implementation

For `system-design-dispute`, stop implementation. A fresh read-only adjudicator
produces a valid
`fsusui-design-conformance.ui-system-adjudication-receipt.v1` that binds the
classification, Skill, authorities, baseline, routing/slice policies, actual
Sol profile, candidate SHA/digest, owner, scope, required follow-up issue,
allowed `sol-low` or `sol-medium` implementation class, and
`requiredReslice=true`.

The adjudicator cannot edit, redesign, expand scope, acquire a write lease, or
sign UX acceptance. After adjudication, re-slice and re-route before resuming.

## 9. Verify behavior and UX independently

Candidate-green enters fresh behavior verification, never directly
behavior-green or UX accepted. After behavior green, a fresh read-only UX
verifier produces a valid
`fsusui-design-conformance.ux-acceptance-receipt.v1`.

That receipt binds candidate SHA/digest, classification and dispatch, actual
routing profile, Skill and authority digests, active baseline, work plan,
slice/prompt/route policies, the inspected production rendered artifacts,
viewport/state/theme/input matrix, blockers, status, and receipt digest.
It also binds distinct implementation-run and verifier-run identity digests;
the implementer cannot sign its own acceptance.

An accepted receipt has no blockers. A rejected receipt has blockers but cannot
include fixes, modified paths, or new design suggestions. Documentation starts
only after behavior green and a candidate-matching accepted UX receipt.

## 10. Recover output-missing without blind retry

Classify a writer without qualifying output as one of:

```text
slice-not-executable
compiled-prompt-incomplete
runtime-invocation-failed
sandbox-cwd-worktree-mismatch
agent-first-action-not-executed
profile-capability-mismatch
```

Changing only agent, attempt ID, prompt wording, worktree, slice ID, or model is
not recovery. Retry requires material re-slicing, a runtime/permission repair,
or a verified profile-capability mismatch with breaker reset authority.

## 11. Preserve design intent

Unless explicitly authorized by the authoritative documents and task:

- preserve information architecture, content order, and action priority;
- preserve the existing primary visual focus;
- do not add cards, surfaces, badges, icons, helper copy, illustrations, calls to action, motion, or decorative effects;
- do not redesign adjacent components;
- do not create new tokens, wrappers, variants, or exceptions;
- do not use generic SaaS patterns, framework defaults, trends, or model preference as design evidence.

Prefer the smallest coherent fix that restores the documented contract.

## 12. Respect FsusUI and consumer ownership

When the public FsusUI primitive is defective, fix FsusUI and its tests. Do not add a compatibility layer, private selector override, fake `--fsus-*` token, or local component fork in the consumer.

When the issue is route composition, product copy, business workflow, public/marketing/editorial layout, or selection among valid variants, keep the change in the consumer. Do not change FsusUI defaults for one consumer.

Each acceptance-group member has its own classification, work plan, slices,
route, baseline, write lease, candidate, and independent receipts. Never inherit
them from a previous member.

## 13. Inspect rendered evidence

Follow `docs/workflows/visual-change.md`:

- inspect the existing rendered state before changing observable output;
- use canonical sources and public APIs;
- complete implementation, focused tests, fixtures, and nearest documentation
  within the same issue/candidate while preserving their separate leases;
- run repository-defined affected checks and visual profiles;
- inspect production-fixture rendered evidence across applicable states,
  themes, viewports, locales, zoom, focus, overflow, keyboard, touch, screen
  reader, and reduced motion;
- do not weaken a checker, threshold, contract, or snapshot to make the result pass.

A passing compile, unit test, static checker, or zero-diff screenshot command is not sufficient for an untested state.

## 14. Completion report

Report:

1. FsusUI baseline and ownership classification;
2. authoritative documents and sections applied;
3. files changed and contracts affected;
4. validation commands and exact results;
5. rendered states and evidence inspected;
6. remaining uncertainty;
7. confirmation that the change did not create a parallel design system, consumer compatibility layer, or undocumented exception.

Do not claim visual acceptance without inspected rendered evidence.
