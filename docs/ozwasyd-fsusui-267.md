# Markdown editor chrome variants

`ElMarkdownEditor` supports three chrome variants through its public `chrome`
prop. The default is `framed`.

```ts
type MarkdownEditorChrome = 'framed' | 'embedded' | 'minimal'
```

Chrome controls the editor's surrounding regions only. It does not change the
selected mode, Markdown source, selection, history, transactions, projection,
renderer, emitted events, or editor and scroll-container identity.

## Variants

| Chrome | Intended context | Toolbar and status | Root treatment |
| --- | --- | --- | --- |
| `framed` | Form fields, settings, and standalone editor use | Shown by default; slots may customize the regions | Full component frame using public tokens |
| `embedded` | An existing document or task surface | Retained when supplied so commands and status remain accessible | No duplicate root border, radius, or material layer |
| `minimal` | A consumer composes command and status UI itself | Hidden when not supplied; no empty region, separator, or reserved height | Content surface and required semantics only |

All variants use one semantic region structure. Regions can be conditionally
visible for a mode or slot, but changing chrome must not switch to a separate
template or remount the editor.

## Modes and regions

The chrome contract applies to every public mode:

| Mode | Editing surface | Rendering surface | Editable |
| --- | --- | --- | --- |
| `source` | Exact source | None | Yes |
| `live` | One progressively rendered editing surface | Inline within that editing surface | Yes |
| `split` | Exact or controlled editing pane | Renderer pane | Yes |
| `preview` | None | Renderer surface | No |

`live` is not a source editor with an overlay preview: it has no duplicate
chrome boundary or second scroll container. In `split`, the separator denotes
the real pane boundary only; it must not recreate a second card. `preview`
continues to expose its accessible name and loading, error, and capability
status even though there is no editing surface.

## Accessibility and stability

In `embedded` and `minimal`, keyboard focus visibility must come from the
active region rather than the removed root border. Hiding a toolbar or status
region must not leave unreachable controls, meaningless separators, or blank
height. Disabled, error, capability, and preview semantics remain available in
every variant.

Switching among `source`, `live`, `split`, and `preview`, or among chrome
variants, preserves the editor instance, selection/history, document geometry,
and scroll-container identity as far as the active mode permits. Consumers use
the public `chrome` prop and slots; they do not need deep selectors, `.el-*`
overrides, DOM forks, or consumer-specific tokens.

## Migration

Use `source`, not `write`, for source editing. `write` is not a supported mode,
class modifier, selector, demo value, test value, or documentation alias.
