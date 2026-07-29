---
'element-plus': patch
---

Add a test-only, consumer-readable Markdown XSS differential corpus and fixed-seed
fuzz gates covering the public runtime, Worker/chunked rendering, SSR,
`initialRender`, feature output sanitization, and Chromium, Firefox, and WebKit
DOM parsing. The corpus, manifest, and kill controls remain excluded from all
production package exports and bundles.
