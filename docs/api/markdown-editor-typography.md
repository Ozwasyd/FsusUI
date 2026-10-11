# MarkdownEditor typography

The additive Web/Vue API is exported from `@ozwasyd/element-plus` through the
existing MarkdownEditor public entry. It applies authoring presentation in the
same editor. It does not store preferences, choose a user/site default, write
Markdown, dispatch a transaction, change history or create a document epoch.

## Closed catalog and resolution

`MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG` is deeply readonly and versioned. Its
`schemaVersion` is `1`; `mappingVersion` is `markdown-editor-typography.v1`.
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
supported combination currently uses `system-sans` and `standard` for the four
other dimensions. Unsupported values identify their dimensions and are blocked
before any presentation write; no private CSS fallback is authorized.

The standard size/line-height/width reference the existing prose typography in
`theme-chalk/markdown-editor.scss`, shared by the old prose profile and this
opt-in through one mixin. There is no duplicate numeric mapping or new token.
Standard paragraph spacing means **preserve source blank lines**: no extra
paragraph gap is introduced and no Markdown separator is rewritten. It is not
a configurable paragraph-margin capability. Consumers needing compact/relaxed
spacing must remain blocked until that capability has a canonical design owner.
Legacy styling remains unchanged when typography is not requested.

The system stack uses the existing OS/generic fallback members and does not use
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
prop flush. `typography-result` emits each outcome, including immediate refusal.
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

The Promise reports `applied` only after class commit, native geometry measure,
the original restore, and a later frame's observed offset readback within one
pixel. Effective size/line-height/canvas width and font family are observed DOM
values. Missing geometry, hidden/unmounted surfaces or a currently loading
document font set fail closed. A layout plan alone is never completion.

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
