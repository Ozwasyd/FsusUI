---
"@ozwasyd/element-plus": patch
---

Fix `ElPublicShell` CSP-safe mobile trigger search overlay (`#1093`) and finalize short-landscape collapsed header height verification (`#828`):

- Scope `csp-safe` native `popover="manual"` promotion strictly to short-landscape viewports (`(max-height: 520px) and (orientation: landscape)`); keep portrait mobile trigger search in normal flow below the primary row with pure CSS classes (`.is-expanded` / `.is-csp-hidden` in both full and critical CSS) and zero inline styles.
- Remove the duplicate inner Cancel button and content wrapper so the primary-row trigger (`text-decoration: none`) is the sole `Search` / `Cancel` control across portrait and short-landscape modes.
- Position the short-landscape CSP popover below the compact header with an opaque paper surface, absorb outside/backdrop taps without clicking through to underlying links, dismiss portrait search on outside pointerdown without stealing focus, and sync portrait <-> short-landscape transitions cleanly.
- Document and verify the `#828` short-landscape collapsed header height budget (`<= 34%` viewport height, `<= 66px` logical height at 200% zoom) while retaining `44px` touch targets across mobile and short-landscape controls.
