# Migrating the Markdown feature output gateway

`ElMarkdownRenderer` no longer accepts `mermaidAdapter`, `latexAdapter`, or
`codeHighlightAdapter`. `MarkdownFeatureAdapter` and the three default adapter
exports are removed. This is a one-time breaking change with no deprecated,
legacy, or versioned branch.

## Consumer migration

Remove callbacks that receive an `HTMLElement` and mutate feature DOM:

```vue
<!-- before -->
<el-markdown-renderer :content="content" :mermaid-adapter="renderMermaid" />

<!-- after -->
<el-markdown-renderer
  :content="content"
  :features="{ mermaid: true, latex: true, codeHighlight: true }"
/>
```

Disable a built-in feature through `features` only:

```vue
<el-markdown-renderer :content="content" :features="{ mermaid: false }" />
```

Do not replace the old callback with a `ShadowRoot`, `DocumentFragment`, or
another DOM container. Consumers no longer submit third-party feature HTML.

## Output and theme boundary

Built-in Mermaid, KaTeX, and Shiki renderers receive immutable source, theme,
and controlled tokens, then return discriminated `FeatureRenderOutput`. The
single FsusUI-owned gateway dispatches by `kind` through three checked-in
policies before committing DOM:

- code highlighting permits only Shiki's declared `pre`, `code`, and `span`
  structure and explicit styles;
- LaTeX uses KaTeX MathML with only declared HTML wrappers, MathML tags, and
  attributes; and
- Mermaid permits only declared SVG tags, attributes, local fragment references,
  and the SVG namespace.

Consumers cannot provide HTML, CSS text, or DOM callbacks to customize themes.
Theme comes from `data-theme-resolved` and typed Element Plus `--el-*` tokens;
`csp-nonce` still supplies the CSP nonce. Color tokens are syntax-validated
before Mermaid/KaTeX use. Mermaid fixes `htmlLabels: false`, so
`foreignObject` is not a label path.

Every policy removes scripts, event attributes, `srcdoc`, `foreignObject`,
executable URLs, external resources, unknown namespaces/tags, and undeclared
attributes. A failed feature writes its error and original source through
`textContent`; the source never enters an HTML parser.

Hosts using `require-trusted-types-for 'script'` and CSP `trusted-types` must
allow `fsusui-markdown-feature`. The gateway creates this private, non-default
policy; it does not reuse `vue` or `fsusblog`. If policy creation is denied,
submission fails closed and the target DOM stays unchanged.

## Package subpath migration

This major change removes broad package deep exports. WASM generated/runtime
internals (`es/wasm/*`, `lib/wasm/*`, and the Markdown feature output gateway)
remain physical build artifacts for package-relative imports but are not
consumer imports:

- Markdown consumers use `@ozwasyd/element-plus/markdown-runtime`.
- WASM consumers use `@ozwasyd/element-plus/wasm`.
- Vue components use the root package; only documented `es|lib/components/*`
  compatibility paths remain when needed.
- Locale and theme assets use `es|lib/locale/*` and `theme-chalk/*`.

Other top-level or deep paths are not exposed by `package.exports`. Do not
rewrite a removed broad import as an encoded path or direct build-directory
lookup.

## Release performance review

`markdown-feature-activation` is an independent real-render scenario and does
not change `markdown-cold` or `markdown-hot`. It waits for Mermaid, KaTeX, and
Shiki activation at initial ready and each `act()`, updates `content-version`
and source for every sample, and rejects a repeated initial `activationMs`.

Build the same Release shape in base and current worktrees and serve each on a
fixed port:

```bash
pnpm run build:demo
pnpm -C vue/packages/demo-app exec vite preview --host 127.0.0.1 --port 5188 --strictPort
```

`build:demo` owns the complete Release demo build: it first materializes the
current-worktree Wasm artifacts through `ensure:wasm`, then builds the demo.
Run it separately in base and current; do not copy, share, or link
candidate/current Wasm artifacts into base.

Run base before current:

```bash
node scripts/web-render-performance.mjs --no-server --port 5188 --scenario markdown-feature-activation --warmups 1 --samples 5 --output .tmp/performance/markdown-feature-activation
```

Current may pass `--baseline <base-summary.json>` from the same runner. The
scenario checks activation p50 and p95; either regression above 5% versus base
fails. It also records five real DOM-parser entry operations: every sample must
be positive and stable, and current's maximum must not exceed baseline's.
These commands consume local builds and do not publish a package.
