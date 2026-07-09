import { buildProps, definePropType } from '@element-plus/utils'
import { useSizeProp } from '@element-plus/hooks'
import { motionModes, motionPresets } from './motion'
import { isRenderPipelineConfigValid } from './render-pipeline'
import { themeModes } from './theme-mode'

import type { ExtractPropTypes } from 'vue'
import type { Language } from '@element-plus/locale'
import type {
  ButtonConfigContract,
  ExperimentalFeatures,
  MessageConfigContract,
  MotionConfigContract,
  RenderPipelineConfigContract,
} from './config-contract'

export const configProviderProps = buildProps({
  /**
   * @description Controlling if the users want a11y features
   */
  a11y: {
    type: Boolean,
    default: true,
  },
  /**
   * @description Locale Object
   */
  locale: {
    type: definePropType<Language>(Object),
  },
  /**
   * @description controls the document theme mode at the application root
   */
  themeMode: {
    type: String,
    values: themeModes,
  },
  /**
   * @description controls global motion mode and preset at the application root
   */
  motion: {
    type: definePropType<MotionConfigContract>(Object),
    validator: (config: MotionConfigContract) =>
      (!config.mode || motionModes.includes(config.mode)) &&
      (!config.preset || motionPresets.includes(config.preset)) &&
      (!config.budget?.maxStaggerItems ||
        config.budget.maxStaggerItems > 0) &&
      (!config.budget?.maxAnimatedNodesPerViewport ||
        config.budget.maxAnimatedNodesPerViewport > 0),
  },
  /**
   * @description controls the shared render pipeline runtime budget.
   */
  renderPipeline: {
    type: definePropType<RenderPipelineConfigContract>(Object),
    validator: isRenderPipelineConfigValid,
  },
  /**
   * @description global component size
   */
  size: useSizeProp,
  /**
   * @description button related configuration, [see the following table](#button-attributes)
   */
  button: {
    type: definePropType<ButtonConfigContract>(Object),
  },
  /**
   * @description features at experimental stage to be added, all features are default to be set to false                                                                                | ^[object]
   */
  experimentalFeatures: {
    type: definePropType<ExperimentalFeatures>(Object),
  },
  /**
   * @description Controls if we should handle keyboard navigation
   */
  keyboardNavigation: {
    type: Boolean,
    default: true,
  },
  /**
   * @description message related configuration, [see the following table](#message-attributes)
   */
  message: {
    type: definePropType<MessageConfigContract>(Object),
  },
  /**
   * @description global Initial zIndex
   */
  zIndex: Number,
  /**
   * @description global component className prefix (cooperated with [$namespace](https://github.com/element-plus/element-plus/blob/dev/packages/theme-chalk/src/mixins/config.scss#L1)) | ^[string]
   */
  namespace: {
    type: String,
    default: 'el',
  },
} as const)
export type ConfigProviderProps = ExtractPropTypes<typeof configProviderProps>
