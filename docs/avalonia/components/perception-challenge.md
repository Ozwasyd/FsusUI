# Perception challenge

Component ID: `perception-challenge`

## Avalonia API

Use `FsusPerceptionChallenge`, `FsusTextTaskChallenge`,
`FsusPerceptionCharacterChallenge`, `FsusLocalizationChallenge`,
`FsusMicroInteractionChallenge`, and submit payload/state/media enums. The
character primitive receives final media; it does not generate or verify a
challenge.

## Vue Contract Mapping

Vue challenge slots and state props map to explicit prompt, state, kind,
localized text, micro-interaction, submit payload, and validation state.
`FsusPerceptionCharacterChallenge` maps the Web media union to optional raster
and audio media, preserves the eight character states, exposes
`FocusResponse()` / `ResetResponse()`, and emits protocol-neutral submit,
refresh, retry, reissue, alternative, and user-initiated audio events.
Replacing `Media` is a lifecycle boundary even when `ChallengeId` and media
metadata are unchanged: the old raster/audio leases are disposed and stale
response/error state is cleared before the replacement becomes interactive.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for localization,
focus, and motion reduction. Avalonia has no library-owned audio player:
`AudioRequested` asks the consumer to play final audio after user action. This
is a semantic adapter, not autoplay or a protocol override.

## Theme Tokens

Challenge controls use surface, border, focus, danger, text, muted text,
density, and motion resources from [`docs/design.md`](../../design.md), including
`FsusSpace3`, `FsusRadiusSurfaceMd`, `FsusThemeBorderBrush`,
`FsusThemeFocusRingBrush`, `FsusThemeDangerBrush`, and
`FsusMotionDurationEffective`.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

using var media = new FsusPerceptionCharacterMedia(
  new FsusPerceptionCharacterRasterMedia(
    finalRaster,
    240,
    80,
    "Characters to transcribe"));

using var challenge = new FsusPerceptionCharacterChallenge
{
  ChallengeId = "character-example",
  AccessibleName = "Character recognition challenge",
  Prompt = "Type the characters shown in the image",
  State = FsusPerceptionChallengeState.Ready,
  Media = media,
};
```

## Known Limitations

The consumer owns Dialog composition, protocol, cancellation, retry policy,
protected workflow, and actual audio playback. Server-side challenge generation
and verification remain outside the UI component. Media purpose text must not
contain an answer, product token, proof, risk score, or machine error code.

Keyboard order is alternative, refresh, response, submit, then state action;
Enter submits from the response input. Automation exposes a group name, a real
label relationship for the response input, polite status, assertive error,
invalid/error help text on the response control, disabled state, and visible
focus. Assigning `State=Disabled` is reflected by the control's effective-enabled
state and automation peer. Reduced motion does not change this order or task
availability. Media actions and the response row use wrapping native panels so
required controls remain arranged at 200% / 400% equivalent widths.

Replacing `Media`, changing `ChallengeId`, or disposing the control releases the
appropriate owned raster and audio leases. Both replacement paths reset stale
response/error state; audio playback remains consumer-owned and can only start
after `AudioRequested` from a user action.
