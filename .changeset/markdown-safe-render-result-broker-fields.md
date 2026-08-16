---
'element-plus': patch
---

Restore the required `parser` and `rawSource` fields on the authorized
Markdown broker render result so the runtime value matches the public
`MarkdownSafeRenderResult` contract.
