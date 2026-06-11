# Icon Semantics

Icon specs define meaning, size, stroke, fill, and pairing behavior without
tying the contract to a specific icon renderer.

## Required Fields

| Field      | Description                                      |
| ---------- | ------------------------------------------------ |
| `id`       | stable semantic icon id                          |
| `intent`   | command, status, navigation, object, or feedback |
| `size`     | token reference such as `icon.size.md`           |
| `stroke`   | token reference for stroke weight                |
| `fill`     | token reference or `none`                        |
| `labeling` | decorative, labelled, or described behavior      |

Icons used as the only visible command label require an accessible name from
the consuming component or pattern.
