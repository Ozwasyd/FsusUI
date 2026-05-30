import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'
import type PublicShell from './public-shell.vue'

export interface PublicShellNavItem {
  key: string
  label: string
  href: string
}

export const publicShellProps = buildProps({
  /**
   * @description public shell hydration marker
   */
  hydrationKind: String,
  /**
   * @description brand text
   */
  brand: {
    type: String,
    default: '',
  },
  /**
   * @description brand link href
   */
  brandHref: {
    type: String,
    default: '/',
  },
  /**
   * @description public navigation items
   */
  navItems: {
    type: definePropType<PublicShellNavItem[]>(Array),
    default: () => [],
  },
  /**
   * @description active public navigation key
   */
  activeNav: {
    type: String,
    default: '',
  },
  /**
   * @description auth/action link label
   */
  authLabel: {
    type: String,
    default: '',
  },
  /**
   * @description auth/action link href
   */
  authHref: {
    type: String,
    default: '',
  },
  /**
   * @description search form action
   */
  searchAction: {
    type: String,
    default: '/search',
  },
  /**
   * @description search input name
   */
  searchName: {
    type: String,
    default: 'q',
  },
  /**
   * @description search input value
   */
  searchQuery: {
    type: String,
    default: '',
  },
  /**
   * @description search placeholder text
   */
  searchPlaceholder: {
    type: String,
    default: 'Search',
  },
  /**
   * @description search input aria label
   */
  searchAriaLabel: {
    type: String,
    default: 'Search',
  },
  /**
   * @description render search controls
   */
  showSearch: {
    type: Boolean,
    default: true,
  },
  /**
   * @description emit search without navigating the form
   */
  spaSearch: Boolean,
  /**
   * @description keep the header sticky
   */
  sticky: {
    type: Boolean,
    default: true,
  },
  /**
   * @description shell max width
   */
  maxWidth: {
    type: String,
    default: '64rem',
  },
} as const)

export const publicShellEmits = {
  [UPDATE_MODEL_EVENT]: (value: string) => typeof value === 'string',
  'update:searchQuery': (value: string) => typeof value === 'string',
  [CHANGE_EVENT]: (value: string) => typeof value === 'string',
  search: (value: string) => typeof value === 'string',
  'search-focus': () => true,
}

export type PublicShellProps = ExtractPropTypes<typeof publicShellProps>
export type PublicShellEmits = typeof publicShellEmits
export type PublicShellInstance = InstanceType<typeof PublicShell>
