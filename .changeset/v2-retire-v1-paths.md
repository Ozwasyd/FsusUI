---
'@ozwasyd/fsusui': major
---

Retire all legacy V1 Element Plus paths, build scripts, dead 6-owner Playwright orchestration, legacy theme-chalk/icons-vue references, and V1 consumer/baseline fixtures during 2.0.0-preview.2 development. Align cross-platform Markdown runtime identity (`@ozwasyd/fsusui/markdown`) across Web, specs, and Avalonia.

Fix all preview.1 consumer-reported issues:
- Rewrite published WASM asset URLs to packaged `dist/wasm/*` targets (#1143)
- Bundle compiled Markdown renderer/parser ESM workers under `dist/workers/*`, rewrite worker URLs, and update default render-pipeline policies to canonical `Fsus*` names (#1148)
- Fix Vue SSR crash for closed `FsusSelect` / `FsusCascader` / `FsusDropdown` Teleports and modernize `docs/guide/ssr.md` (#1144)
- Associate `FsusFormItem` labels and errors with `FsusSelect` combobox via `id` / `aria-labelledby` / `aria-describedby` / label click focus / Space-to-open (#1145)
- Forward native input and accessibility attributes (`id`, `aria-*`, `required`, `inputmode`, etc.) onto `<input>` / `<textarea>` inside `FsusInput` (`inheritAttrs: false`) (#1146)
- Update `docs/migration/v1-to-v2.md` for `virtualThreshold` automatic virtualization and `FsusTabs` inactive-pane unmount lifecycle (#1147, #1149)
- Associate `FsusTabs` tabs and panels with unique `id`, `aria-controls`, and `aria-labelledby` attributes (#1149)
- Guard missing or failing `navigator.clipboard.writeText` in `FsusCopyableDetail` with localized status announcements (`role="status"`), `copy`/`copyError` emits, and explicit error feedback (#1150)
- Isolate `createFsusUI()` configuration per Vue application via `installFsusConfig()` / `FSUS_CONFIG_KEY` without mutating module-global defaults (#1151)
- Scope `FsusMessage` per Vue application via `useFsusMessage()`, `createFsusMessageService()`, `installFsusMessage()`, and `FSUS_MESSAGE_KEY` with `AppContext` propagation, idempotent `onClose`, SSR safety, and automatic `app.onUnmount()` teardown (#1152)
