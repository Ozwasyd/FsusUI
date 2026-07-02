# Perception challenge

Component ID: `perception-challenge`

## Avalonia API

Use `FsusPerceptionChallenge`, `FsusTextTaskChallenge`,
`FsusLocalizationChallenge`, `FsusMicroInteractionChallenge`, and submit
payload/state enums.

## Vue Contract Mapping

Vue challenge slots and state props map to explicit prompt, state, kind,
localized text, micro-interaction, submit payload, and validation state.

## Supported Platform Differences

Localization rendering, focus state, and motion reduction follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Challenge controls use surface, border, focus, danger, text, muted text,
density, and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var challenge = new FsusPerceptionChallenge
{
  AccessibleName = "Verification challenge",
  Prompt = "Type the displayed phrase",
};
```

## Known Limitations

Server-side challenge verification remains outside the UI component.
