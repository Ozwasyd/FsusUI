import type LocalizationChallenge from './localization-challenge.vue'
import type MicroInteractionChallenge from './micro-interaction-challenge.vue'
import type PerceptionChallenge from './perception-challenge.vue'
import type TextTaskChallenge from './text-task-challenge.vue'

export type PerceptionChallengeInstance = InstanceType<
  typeof PerceptionChallenge
>
export type TextTaskChallengeInstance = InstanceType<typeof TextTaskChallenge>
export type LocalizationChallengeInstance = InstanceType<
  typeof LocalizationChallenge
>
export type MicroInteractionChallengeInstance = InstanceType<
  typeof MicroInteractionChallenge
>
