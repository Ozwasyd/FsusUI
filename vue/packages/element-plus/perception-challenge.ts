// Stable subpath module: `@ozwasyd/element-plus/perception-challenge`
//
// Preview public API for downstream consumers that need the perception-challenge
// components and their typed contracts without depending on the deep
// `@element-plus/components/perception-challenge` package path. Surface area
// mirrors the named exports documented in
// `vue/packages/element-plus/index.ts`; do not add internal-only exports here.

export {
  ElPerceptionChallenge,
  ElTextTaskChallenge,
  ElLocalizationChallenge,
  ElMicroInteractionChallenge,
  FsusPerceptionChallenge,
  FsusTextTaskChallenge,
  FsusLocalizationChallenge,
  FsusMicroInteractionChallenge,
} from '@element-plus/components/perception-challenge'

export type {
  PerceptionChallengeAssignment,
  PerceptionChallengeClient,
  PerceptionChallengeExpiredPayload,
  PerceptionChallengeKind,
  PerceptionChallengeRenderPayload,
  PerceptionChallengeRenderer,
  PerceptionChallengeState,
  PerceptionChallengeSubmitPayload,
  PerceptionChallengeVerifyResult,
} from '@element-plus/components/perception-challenge'
