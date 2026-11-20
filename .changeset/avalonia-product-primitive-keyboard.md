---
'element-plus': patch
---

Fix native Arrow/Home/End keyboard routing for Avalonia
`FsusSettingsSectionNav`, `FsusDiagnosticsList`, and `FsusConversationList`.
Respect disabled and already handled input, skip disabled conversation items,
and leave unsupported or empty-list input unhandled without initializing
diagnostics focus. No migration is required.
