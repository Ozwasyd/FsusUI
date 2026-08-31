# Issue 708 independent UX review

Status: accepted for the local Avalonia Headless/Skia rendered-evidence class.

Reviewer: `/root/acceptance_audit` (independent of the implementation
worktree changes).

The five 960x540 production-fixture captures were individually inspected at
original resolution, and their SHA-256 digests match the render manifest. Each
capture uses the production desktop Markdown shell composite
`FsusNativeTitleBar` + `FsusActivityRailShell` + `FsusDocumentTabs`, together
with `FsusTextEditor`, `FsusMarkdownEditor`, `FsusTree`, `FsusSelect`,
`FsusIcon`, and `FsusText` controls rather than palette swatches.
Every capture applies reduced motion and places keyboard focus on the
production `FsusSelect`; no pointer interaction is claimed by this evidence.

- Light preserves distinct window/shell background, contextual/component
  surface, title/tab/rail raised surface, primary text, muted text, border, and
  icon roles.
- Dark preserves the expected dark surface hierarchy with legible primary and
  muted text and a distinct icon role.
- The complete custom palette visibly reaches title bar, activity rail,
  contextual pane, document tabs, both editor controls, tree, picker, read-only
  raised state, text roles, borders, and real icons; its diagnostic brushes are
  evidence, not a proposed product palette.
- The partial dark palette keeps the built-in dark background, raised surface,
  text, and border while independently overriding shell/component surfaces and
  the icon brush.
- High contrast retains its black surfaces, white border and primary text,
  yellow muted text, white icon, and crisp separation even when conflicting
  custom surface, raised-surface, and icon brushes are supplied.

No capture is clipped or overflowing, and no decorative scope expansion is
present. There is no rendered blocker for issue 708. This review does not claim
a physical display, operating-system assistive technology, runtime API
semantics, or mutation coverage beyond the rendered artifacts and manifest.
