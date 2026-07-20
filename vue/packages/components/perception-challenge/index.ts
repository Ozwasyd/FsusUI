import { withInstall } from '@element-plus/utils'

import LocalizationChallenge from './src/localization-challenge.vue'
import MicroInteractionChallenge from './src/micro-interaction-challenge.vue'
import PerceptionCharacterChallenge from './src/character-challenge.vue'
import PerceptionChallenge from './src/perception-challenge.vue'
import TextTaskChallenge from './src/text-task-challenge.vue'

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) =>
  ({
    ...component,
    name,
  }) as T

export const ElPerceptionChallenge = withInstall(PerceptionChallenge, {
  FsusPerceptionChallenge: withFsusAlias(
    PerceptionChallenge,
    'FsusPerceptionChallenge',
  ),
})
export const FsusPerceptionChallenge =
  ElPerceptionChallenge.FsusPerceptionChallenge

export const ElPerceptionCharacterChallenge = withInstall(
  PerceptionCharacterChallenge,
  {
    FsusPerceptionCharacterChallenge: withFsusAlias(
      PerceptionCharacterChallenge,
      'FsusPerceptionCharacterChallenge',
    ),
  },
)
export const FsusPerceptionCharacterChallenge =
  ElPerceptionCharacterChallenge.FsusPerceptionCharacterChallenge

export const ElTextTaskChallenge = withInstall(TextTaskChallenge, {
  FsusTextTaskChallenge: withFsusAlias(
    TextTaskChallenge,
    'FsusTextTaskChallenge',
  ),
})
export const FsusTextTaskChallenge = ElTextTaskChallenge.FsusTextTaskChallenge

export const ElLocalizationChallenge = withInstall(LocalizationChallenge, {
  FsusLocalizationChallenge: withFsusAlias(
    LocalizationChallenge,
    'FsusLocalizationChallenge',
  ),
})
export const FsusLocalizationChallenge =
  ElLocalizationChallenge.FsusLocalizationChallenge

export const ElMicroInteractionChallenge = withInstall(
  MicroInteractionChallenge,
  {
    FsusMicroInteractionChallenge: withFsusAlias(
      MicroInteractionChallenge,
      'FsusMicroInteractionChallenge',
    ),
  },
)
export const FsusMicroInteractionChallenge =
  ElMicroInteractionChallenge.FsusMicroInteractionChallenge

export default ElPerceptionChallenge

export * from './src/shared'
export type * from './src/instance'
