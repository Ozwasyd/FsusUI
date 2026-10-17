# MarkdownEditor typography

The additive Web/Vue API is exported from `@ozwasyd/element-plus` through the
existing MarkdownEditor public entry. It applies authoring presentation in the
same editor. It does not store preferences, choose a user/site default, write
Markdown, dispatch a transaction, change history or create a document epoch.

## Closed catalog and resolution

`MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG` is deeply readonly and versioned. Its
`schemaVersion` is `1`; `mappingVersion` is `markdown-editor-typography.v2`.
`resolveMarkdownEditorTypography(input: unknown)` rejects missing/extra keys,
symbols, accessors, non-records, future schemas and arbitrary values. The exact
input is `MarkdownEditorTypographyProfile`:

```ts
type MarkdownEditorTypographyProfile = Readonly<{
  schemaVersion: 1
  fontFamily: 'system-sans' | 'reading-serif' | 'cjk-sans'
  fontSize: 'compact' | 'standard' | 'large'
  lineHeight: 'compact' | 'standard' | 'relaxed'
  canvasWidth: 'narrow' | 'standard' | 'wide'
  paragraphSpacing: 'compact' | 'standard' | 'relaxed'
}>
```

Resolution discriminates `invalid`, `unsupported` and `supported`. Valid
schema combinations are not automatically available capabilities. The only
supported family currently uses `system-sans`; size/line-height/width have three
discrete choices while paragraph spacing only supports `standard` (27 of 243
valid combinations). Unsupported values identify their dimensions and are blocked
before any presentation write; no private CSS fallback is authorized.

The standard size/line-height/width reference the existing prose typography in
`theme-chalk/markdown-editor.scss`, shared by the old prose profile and this
opt-in through one mixin. There is no duplicate numeric mapping or new token.
Standard paragraph spacing means **preserve source blank lines**: no extra
paragraph gap is introduced and no Markdown separator is rewritten. It is not
a configurable paragraph-margin capability. Consumers needing compact/relaxed
spacing must remain blocked until that capability has a canonical design owner.
Legacy styling remains unchanged when typography is not requested.

The system stack uses the existing canonical generic fallback members and does not use
the configurable branded font token. There are no font URLs, assets, stylesheet
insertion, `FontFace`, font loaders or retries. Reading-serif/CJK-sans stay
unsupported: no registered pinned/license-known asset contract was found.
`font.state: 'current'` means an observed system-stack presentation, not proven
font-file loading, glyph coverage, license or network qualification.

## Apply and actual completion

```ts
editor.applyTypography({
  profile,
  expectedDocumentIdentity: { id, epoch },
  expectedRevision: revision,
  requestId,
}): Promise<MarkdownEditorTypographyResult>
```

The optional `typography` prop takes the same immutable request. Initial props
are applied after mount; subsequent request objects are applied after the Vue
prop flush. While mounted, `typography-result` reports outcomes, including
immediate refusal, through a microtask so consumer callbacks cannot reenter a
partly completed scheduler frame. Results retain their captured request identity;
they are not relabeled with later props. Disposal still resolves the pending
Promise and suppresses notifications to the unmounted surface.
Removing the prop cancels pending work; it does not select a preference default.
Request IDs are bounded correlation IDs, not persistence/CAS/idempotency receipts.

Identity and revision are read from the existing transaction store at capture
and checked before every phase. Opaque document IDs are compared verbatim.
Apply never changes source, logical selection, history or epoch. New requests
supersede one bounded pending request. Document/source replacement, disposal,
surface change, selection change, IME, user scrolling and competing layout work
invalidate it; an invalidated request cannot acknowledge the current document.

The existing `captureMarkdownLiveLayoutAnchor` binds source node/range/affinity
to identity/revision. Native text geometry is measured in a temporary, hidden,
text-only mirror of the original textarea. This is geometry for that anchor,
not another editor or position map. All reads, mirror/class writes and scroll
restore use the existing editor frame scheduler. The original viewport restore
accepts the measured anchor's original pixel offset instead of repositioning it
at a fraction of the viewport. No percentage or unconditional scrollIntoView is
an exact-continuity acknowledgement.

## Engineering mapping v2

The following choices are **new engineering design choices in this source
increment**, not numerical claims about the original five-dimension contract.
The original prose standard metrics remain compatible. The owning SCSS is the
only numerical implementation authority; the public catalog names its real
tokens/contracts and reports actual DOM values after apply.

| Dimension | Choice | Owning implementation / real token | Reason |
| --- | --- | --- | --- |
| fontFamily | system-sans | `system-ui, sans-serif`, members of `typography.family.body` | Generic system families cannot select an app's URL-backed named font face. No branded-font token or asset loading. |
| fontSize | compact | `--el-font-size-medium` (existing 16px scale) | One readable size step below the existing prose 18px, avoiding auxiliary caption sizes. |
| fontSize | standard | Existing prose 18px | Compatibility with the existing authoring profile. |
| fontSize | large | `--el-font-size-extra-large` (existing 20px scale) | One existing scale step above prose; no arbitrary numeric input. |
| lineHeight | compact | Existing source-editor 1.6 ratio | Reuses a current editor rhythm. |
| lineHeight | standard | Existing prose 1.84 ratio | Prose compatibility. |
| lineHeight | relaxed | Prose line-height plus `--fsus-space-1` | One existing tight spacing step adds breathing room without redefining a token. |
| canvasWidth | narrow | Prose width minus two `--fsus-space-8` steps | Bounded inward step around the same existing prose measure. |
| canvasWidth | standard | Existing prose measure | Prose compatibility. |
| canvasWidth | wide | Prose width plus two `--fsus-space-8` steps | Bounded outward step; every choice still converges at 100% of its container. |
| paragraphSpacing | standard | Source blank-line separation, unchanged | Native textarea paragraph semantics are source-owned. |

Reading-serif/CJK-sans remain unsupported because no registered pinned asset
contract is available. Compact/relaxed paragraph spacing remain unsupported
because an independent paragraph gap cannot be applied to a native textarea
without changing its source or replacing its input/geometry authority. A font
size/line-height change is not falsely reported as that missing capability.
Invalid or non-readable computed font sizes are interrupted rather than acked.
No public article theme, global token, settings default policy, snapshot or
frozen design baseline is changed. These are reviewable design candidates, not
rendered/visual/font/Unicode/network acceptance.

The Promise reports `applied` only after class commit, native geometry measure,
the original restore, and a later frame's observed offset readback within one
pixel. Effective size/line-height/canvas width and font family are observed DOM
values. Missing geometry, hidden/unmounted surfaces or a currently loading
document font set fail closed. A layout plan alone is never completion.

Each later measure is submitted through a microtask after the current scheduler
frame finishes, including the original viewport restore. Post-paint callbacks
do not directly submit a measure while the scheduler is still in its write phase.
Native scroll cancels the pending operation before selection/typewriter/resize
early returns. Only the one expected scroll at the editor's own restore target
is exempt; every measure also checks that the viewport has not moved independently.

Completion compares actual computed font size, line height and border-box width
with an empty hidden reference in the same grid cell. The reference uses the same
owning SCSS rules and private mapping markers as the requested profile, so theme
token customization and container clamps resolve through CSS rather than a second
numeric mapping in JavaScript. The later readback repeats the comparison. Missing
current mapping markers, overridden actual metrics or unavailable reference/native
geometry interrupt completion. Neither node is an editor or an input surface.

- `applied`: captured identity/revision/selection/anchor, actual effective
  profile and `settle: 'restored-after-frame'` with before/after pixel offsets.
- `rejected`: no visual commit, reason and `settle: 'not-applied'`.
- `interrupted`: a visual commit happened but exact completion failed; effective
  observations may be present and `settle: 'incomplete'`. This is not an ack.

Boundary clamps may make exact offset retention impossible; that is an
interruption, not fabricated success. Preview-only has no input anchor and
rejects apply; an already applied profile follows subsequent surface changes.
Source/live and the original focus layer share one presentation. Typewriter
automatic re-centering yields during this bounded restore; manual scroll and
selection drag still cancel it. Reduced motion introduces no reflow animation.

## Verification limits

This source offer is additive Web/Vue work. Avalonia parity, installed/published
package qualification, rendered/browser/device/IME/Unicode/font/network/zoom/
performance and consumer receipts need separate exact-source evidence. Static
type/SFC/AST/SCSS checks cannot qualify those paths. The existing authority94/95
failure, runtime holds and unrelated historical failures remain open. The API
does not declare all 243 schema combinations supported or issue a receipt.
