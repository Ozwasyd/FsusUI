# Markdown Interaction Trace

`@ozwasyd/element-plus/markdown-runtime` exposes the experimental
`fsusui.interaction.v2` trace helpers used by the Web conformance runner.
They record public interactions against real mounted Vue components; they are
not a component mock or a substitute for browser execution.

## Contract identity

Every trace identifies the committed Contract V2 registry:

- source: `spec/components/contracts/v2/contract-v2.json`;
- schema version and registry version;
- baseline and candidate revisions;
- browser name, project, and runtime version.

Every step carries a concrete `component-v2.*` contract id and a matching
`scenario.v2.<component>.*` scenario id. The Playwright runner resolves both
values from the committed registry before it performs the action. A fabricated
component/scenario pair is rejected by `validateMarkdownInteractionTrace`.

## Runtime evidence

The runner records the action, public target, expected and actual result,
emitted events, and artifact name for every step. MarkdownEditor traces also
record selection direction, revision, undo/redo depth, document identity, and
capability. Native IME cells reference the dedicated evidence owned by #319 and
#320 instead of claiming local synthetic input as hardware evidence.

The validator rejects traces that contain no executed action, omit actual event
evidence, use a mock or metadata mount, drift from the browser/revision
identity, or contain a failed step. Mutation evaluation covers no-op actions,
uncaptured events, mock-only runners, and metadata-only runners.

## Verification

Run the local browser matrix with:

```sh
pnpm run test:markdown-editor:interaction
```

The command executes Chromium, Firefox, and WebKit projects. These are local
browser simulations and do not claim external device, native IME, or remote CI
coverage.
