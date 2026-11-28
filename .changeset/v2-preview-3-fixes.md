---
'@ozwasyd/fsusui': major
---

Fix preview.2 consumer-reported issues in 2.0.0-preview.3:

- Declare `id?: string` on `FsusInputProps` so `<FsusInput id="..." />` passes strict Vue template type checking (`vue-tsc` with `"strictTemplates": true`) while continuing to render a single native `id` on `<input>` / `<textarea>` (#1154)
- Link `FsusMessageBox` `role="alertdialog"` to its heading and body message via unique `aria-labelledby` / `aria-describedby` (plus fallback `aria-label` when untitled) so confirmation dialogs expose accessible names and descriptions (#1155)
- Route `useEscapeKeydown` and `useFocusTrap` through LIFO active overlay stacks with consumed-event tracking so one physical `Escape` belongs strictly to the active top overlay regardless of mount/listener order, retains explicit `closeOnEscape=false`, and restores focus to the connected parent opener (#1156)
- Bridge consumer-bundled optional Markdown heavy-feature runtime loaders (`shiki`, `katex`, `mermaid`) into the isolated rendering frame via a single-use capability-gated host bridge so Vite production builds resolve `shiki/core`, KaTeX, and Mermaid cleanly without relaxing isolation or CSP (#1157)
