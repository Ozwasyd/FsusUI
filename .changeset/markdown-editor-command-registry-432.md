---
'element-plus': patch
---

Complete the markdown editor unified command registry aggregation (#432): `isMarkdownEditorCommandEnabled` now fails closed in `preview` mode, so commands stay listed in every mode but cannot run from any invocation path (button, palette, or shortcut). Command contexts that expose private editor handles (textarea, DOM, or third-party editor instances) are rejected by the command snapshot.
