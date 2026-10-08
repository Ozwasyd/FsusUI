# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: markdown-interaction-trace.spec.ts >> mounts representative Vue components and traces real public interactions
- Location: vue/tests/markdown-editor/markdown-interaction-trace.spec.ts:271:5

# Error details

```
Error: browserType.launch: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Missing libraries:                                   ║
║     libgtk-4.so.1                                    ║
║     libgraphene-1.0.so.0                             ║
║     libharfbuzz-icu.so.0                             ║
║     libmanette-0.2.so.0                              ║
║     libhyphen.so.0                                   ║
║     libwoff2dec.so.1.0.2                             ║
║     libGLESv2.so.2                                   ║
╚══════════════════════════════════════════════════════╝
```