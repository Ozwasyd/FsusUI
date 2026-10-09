# Public Tag multiline fixture

This fixture imports the real public `ElTag` and production theme through a
source alias. It has no component, data, or theme stubs and changes no shared
Playwright registry or golden. It requires the repository's installed Vite,
Vue, and Playwright dependencies and Chromium (`CHROMIUM_PATH` can select the
browser executable).

List before selecting; an empty or unknown selection exits before startup:

```sh
node vue/packages/components/tag/__tests__/browser/check-tag.mjs --list
node vue/packages/components/tag/__tests__/browser/check-tag.mjs --case default layout text semantics keyboard
```

Startup verifies the fixture state hook and exactly five real Tag roots.
Every selected case checks a positive number of controls. `layout` covers
closable Tags and inline icons; `text` covers full labels without close controls
in LTR/RTL. Both use long identifiers, CJK/status text, Arabic, and empty labels.
Tone comparisons wait for actual theme transitions to finish. SVG viewport
clipping is a browser drawing default; HTML label/control boxes must not clip,
and all text ranges must fit within their Tag root. No clipping exception is
made in the plain-text case.

The `baseline` case retains the default-mode containment failure. The published
consumer originally reported a 143px label inside a 20px small Tag at 160px.
This fixture records its own current dimensions (132px inside 20px with no body
margin). It asserts that the failure remains observable; its successful
execution is not a layout pass.

```sh
TAG_EVIDENCE_ROOT=/tmp/tag-evidence node vue/packages/components/tag/__tests__/browser/check-tag.mjs --case baseline
```

`TAG_EVIDENCE_ROOT` records measurements and screenshots. Inspect the rendered
images before claiming visual results. These are producer controls; the
unchanged production Blog card/checker and independent consumer acceptance
remain separate.
