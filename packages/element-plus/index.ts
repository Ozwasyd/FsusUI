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
  createMotionPlugin,
  getMotionPhaseState,
  getMotionPreset,
  isMotionPresetName,
  isMotionReducedOrDisabled,
  motionCssVars,
  motionPresets as motionPresetDefinitions,
  motionTokens,
  normalizeMotionOptions,
  resolveMotionPresetName,
  runMotion,
  vMotion,
} from '@element-plus/motion'
export type {
  MotionDirectiveValue,
  MotionOptions,
  MotionPhase,
  MotionPluginConfig,
  MotionPresetDefinition,
  MotionPresetName,
  MotionRunOptions,
  MotionRuntimeControls,
  MotionStyleState,
  MotionTokens,
} from '@element-plus/motion'

export const install = installer.install
export const version = installer.version
export { groupedInstaller } from './defaults'
export default installer

export { default as dayjs } from 'dayjs'
