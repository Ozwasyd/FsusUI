import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes } from 'vue'
import type PublicShell from './public-shell.vue'

export interface PublicShellNavItem {
  key: string
  label: string
  href: string
}

export type PublicShellMobileSearchMode = 'inline' | 'trigger' | 'none'
export type PublicShellMobileNavMode = 'inline' | 'menu' | 'bottom' | 'none'
export type PublicShellActiveNavMotion = 'none' | 'indicator'

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
   * @description explicit mobile navigation presentation; fixed bottom tabs are opt-in
   */
  mobileNavMode: {
    type: definePropType<PublicShellMobileNavMode>(String),
    values: ['inline', 'menu', 'bottom', 'none'],
    default: 'menu',
  },
  /**
   * @description accessible label for mobile navigation landmarks
   */
  mobileNavLabel: {
    type: String,
    default: 'Primary navigation',
  },
  /**
   * @description visible label for the mobile navigation menu trigger
   */
  mobileNavMenuLabel: {
    type: String,
    default: 'Menu',
  },
  /**
   * @description active public navigation key
   */
  activeNav: {
    type: String,
    default: '',
  },
  /**
   * @description active navigation motion presentation
   */
  activeNavMotion: {
    type: definePropType<PublicShellActiveNavMotion>(String),
    values: ['none', 'indicator'],
    default: 'none',
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
   * @description mobile search presentation
   */
  mobileSearchMode: {
    type: definePropType<PublicShellMobileSearchMode>(String),
    values: ['inline', 'trigger', 'none'],
    default: 'inline',
  },
  /**
   * @description mobile search trigger label
   */
  mobileSearchTriggerLabel: {
    type: String,
    default: '',
  },
  /**
   * @description mobile search cancel label
   */
  mobileSearchCancelLabel: {
    type: String,
    default: 'Cancel',
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
  /**
   * @description desktop brand/navigation gap
   */
  navGap: {
    type: String,
    default: '2rem',
  },
  /**
   * @description mobile navigation item gap
   */
  mobileNavGap: {
    type: String,
    default: '1.5rem',
  },
  /**
   * @description mobile search width
   */
  mobileSearchWidth: {
    type: String,
    default: '7rem',
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
