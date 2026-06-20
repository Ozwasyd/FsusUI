# Stable Component Contract Catalog

The complete versioned source registry is
[`contracts/v1/vue-public-contracts.json`](./contracts/v1/vue-public-contracts.json).
It is generated from the Vue public API baseline and validated by
`pnpm run conformance:contracts`.

The table below keeps the original first controls as a human-readable summary.
It intentionally avoids DOM, Vue, XAML, and platform template details.

| ID            | Contract Summary                                       | Core States                                               | Required Token Groups                     |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------- |
| `button`      | triggers an immediate command                          | default, hover, pressed, focus-visible, disabled, loading | color, brush, space, radius, motion       |
| `icon-button` | compact command with icon-only or icon-primary content | default, hover, pressed, focus-visible, disabled, loading | icon, color, space, radius, motion        |
| `input`       | single-line text entry                                 | default, hover, focus, disabled, readonly, invalid        | color, typography, border, radius, space  |
| `textarea`    | multi-line text entry                                  | default, hover, focus, disabled, readonly, invalid        | color, typography, border, radius, space  |
| `checkbox`    | binary or mixed selection                              | unchecked, checked, mixed, focus-visible, disabled        | color, radius, motion, icon               |
| `radio`       | single selection inside a set                          | unchecked, checked, focus-visible, disabled               | color, radius, motion                     |
| `switch`      | binary setting toggle                                  | off, on, focus-visible, disabled, loading                 | color, radius, motion                     |
| `card`        | grouped surface with optional command behavior         | static, hoverable, selected, disabled                     | brush, border, radius, shadow, motion     |
| `divider`     | visual or semantic separation                          | horizontal, vertical, inset                               | color, thickness, space                   |
| `tag`         | compact metadata label                                 | default, removable, selected, disabled                    | color, radius, typography, space          |
| `badge`       | small count or status indicator                        | neutral, info, success, warning, danger                   | color, typography, radius                 |
| `alert`       | contextual message with optional actions               | info, success, warning, danger, dismissible               | color, typography, radius, icon, motion   |
| `tooltip`     | transient contextual help                              | hidden, visible, delayed, disabled                        | brush, typography, radius, shadow, motion |
| `dialog`      | blocking overlay surface                               | hidden, entering, open, leaving, loading                  | brush, shadow, radius, z, motion          |
| `tabs`        | switch between peer content panels                     | inactive, active, hover, focus-visible, disabled          | color, typography, space, motion          |
| `menu`        | structured command or navigation set                   | collapsed, expanded, selected, hover, disabled            | color, typography, space, motion, icon    |

## Example Contract Shape

```yaml
id: button
displayName: FsusButton
props:
  variant:
    values: [default, primary, success, warning, danger, text]
    default: default
  size:
    values: [sm, md, lg]
    default: md
  disabled:
    type: boolean
    default: false
  loading:
    type: boolean
    default: false
states:
  - default
  - pointerover
  - pressed
  - focus-visible
  - disabled
  - loading
events:
  press:
    when: enabled command activation completes
contentRegions:
  leadingIcon: optional
  label: required unless accessibleName is supplied
  trailingIcon: optional
keyboard:
  Enter: activate
  Space: activate
accessibility:
  role: command
  name: required
  disabledState: required
tokens:
  background: color.button.{variant}.background
  foreground: color.button.{variant}.foreground
  radius: radius.control.md
  paddingX: space.button.{size}.x
  motion: motion.duration.control.fast
```
