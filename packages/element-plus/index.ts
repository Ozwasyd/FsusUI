import installer from './defaults'
export * from '@element-plus/components'
export * from '@element-plus/constants'
export * from '@element-plus/directives'
export * from '@element-plus/hooks'
export * from './make-installer'
export * from './render-pipeline-policies'
export * from './result'
export {
  FsuMotion,
  FsuTransition,
  cancelMotion,
  createMotionRouteCleanup,
  createMotionPlugin,
  getMotionPhaseState,
  getMotionPreset,
  getGsap,
  getGsapPresetVars,
  isScrollTriggerRegistered,
  isMotionPresetName,
  isMotionReducedOrDisabled,
  killScrollTriggersFor,
  millisecondsToSeconds,
  motionCssVars,
  motionPresets as motionPresetDefinitions,
  motionTokens,
  normalizeMotionOptions,
  refreshScrollTriggers,
  registerScrollTrigger,
  resolveMotionPresetName,
  resolveMotionTarget,
  sanitizeGsapVars,
  runMotion,
  useGsapContext,
  useMotionRouteCleanup,
  useScrollReveal,
  useTimeline,
  vMotion,
  vScrollReveal,
} from '@element-plus/motion'
export type {
  GsapContextCallback,
  GsapScope,
  MotionDirectiveValue,
  MotionOptions,
  MotionPhase,
  MotionPluginConfig,
  MotionPresetDefinition,
  MotionPresetName,
  MotionRunOptions,
  MotionRuntimeControls,
  MotionStyleState,
  MotionTarget,
  MotionTimelineStep,
  ScrollRevealOptions,
  ScrollRevealRunOptions,
  UseTimelineOptions,
  MotionTokens,
} from '@element-plus/motion'

export const install = installer.install
export const version = installer.version
export { groupedInstaller } from './defaults'
export default installer

export { default as dayjs } from 'dayjs'
