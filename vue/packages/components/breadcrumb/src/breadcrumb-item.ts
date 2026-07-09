import { buildProps, definePropType } from '@element-plus/utils'
import type { ExtractPropTypes } from 'vue'
import type { NavigationFailure, RouteLocationRaw } from 'vue-router'

export type BreadcrumbRouterLike = {
  push: (to: RouteLocationRaw) => Promise<void | NavigationFailure>
  replace: (to: RouteLocationRaw) => Promise<void | NavigationFailure>
}

export const breadcrumbItemProps = buildProps({
  /**
   * @description target route of the link, same as `to` of `vue-router`
   */
  to: {
    type: definePropType<RouteLocationRaw>([String, Object]),
    default: '',
  },
  /**
   * @description if `true`, the navigation will not leave a history record
   */
  replace: {
    type: Boolean,
    default: false,
  },
  routerInstance: {
    type: definePropType<BreadcrumbRouterLike>(Object),
  },
} as const)
export type BreadcrumbItemProps = ExtractPropTypes<typeof breadcrumbItemProps>
