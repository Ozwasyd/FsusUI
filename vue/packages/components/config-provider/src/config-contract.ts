import type { Language } from '@element-plus/locale'
import type { ComponentSize } from '@element-plus/constants'
import type { MotionConfigContract } from './motion'
import type { RenderPipelineConfigContract } from './render-pipeline'
import type { ThemeMode } from './theme-mode'

export type { MotionConfigContract } from './motion'
export type {
  RenderPipelineAccelerationConfig,
  RenderPipelineCompositorMode,
  RenderPipelineConfigContract,
  RenderPipelineHardwareMode,
} from './render-pipeline'

export type ExperimentalFeatures = {
  // TO BE Defined
}

export type ButtonConfigContract = {
  autoInsertSpace?: boolean
}

export type MessageConfigContract = {
  max?: number
}

export type ConfigProviderContract = {
  a11y?: boolean
  locale?: Language
  size?: ComponentSize
  themeMode?: ThemeMode
  motion?: MotionConfigContract
  renderPipeline?: RenderPipelineConfigContract
  button?: ButtonConfigContract
  experimentalFeatures?: ExperimentalFeatures
  keyboardNavigation?: boolean
  message?: MessageConfigContract
  zIndex?: number
  namespace?: string
}
