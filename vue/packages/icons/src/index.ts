import { defineComponent, h, reactive, type PropType } from 'vue'
import { FSUS_ICON_PATHS, type FsusIconName } from './icon-paths'

export { FSUS_ICON_PATHS, type FsusIconName }

const customIconRegistry = reactive<Record<string, string>>({})

export const registerFsusIcon = (name: string, pathData: string): void => {
  customIconRegistry[name] = pathData
}

export const registerFsusIcons = (icons: Record<string, string>): void => {
  for (const [name, pathData] of Object.entries(icons)) {
    customIconRegistry[name] = pathData
  }
}

export const resolveFsusIconPath = (name?: string): string | undefined => {
  if (!name) return undefined
  return customIconRegistry[name] ?? (FSUS_ICON_PATHS as Record<string, string>)[name]
}

export interface FsusIconProps {
  name?: FsusIconName | (string & {})
  path?: string
  size?: number | string
  color?: string
  spin?: boolean
  label?: string
  decorative?: boolean
  variant?: 'default' | 'linear'
  viewBox?: string
}

const toCssSize = (size?: number | string): string | undefined => {
  if (size === undefined || size === '') return undefined
  return typeof size === 'number' || /^\d+(?:\.\d+)?$/.test(size) ? `${size}px` : size
}

export const FsusIcon = defineComponent({
  name: 'FsusIcon',
  props: {
    name: { type: String as PropType<FsusIconName | (string & {})>, default: undefined },
    path: { type: String, default: undefined },
    size: { type: [Number, String] as PropType<number | string>, default: undefined },
    color: { type: String, default: undefined },
    spin: { type: Boolean, default: false },
    label: { type: String, default: undefined },
    decorative: { type: Boolean, default: undefined },
    variant: { type: String as PropType<'default' | 'linear'>, default: undefined },
    viewBox: { type: String, default: '0 0 1024 1024' },
  },
  setup(props, { slots }) {
    return () => {
      const resolvedPath = props.path ?? resolveFsusIconPath(props.name)
      const isDecorative = props.decorative ?? !props.label
      const fontSize = toCssSize(props.size)
      const style: Record<string, string> = {}
      if (fontSize) style.fontSize = fontSize
      if (props.color) style.color = props.color

      return h(
        'span',
        {
          class: 'fsus-icon',
          'data-spin': props.spin ? '' : undefined,
          'data-variant': props.variant === 'linear' ? 'linear' : undefined,
          'aria-hidden': isDecorative ? 'true' : undefined,
          'aria-label': isDecorative ? undefined : props.label,
          role: isDecorative ? undefined : 'img',
          ...(Object.keys(style).length ? { style } : {}),
        },
        slots.default
          ? slots.default()
          : resolvedPath
            ? [
                h(
                  'svg',
                  {
                    viewBox: props.viewBox,
                    width: '1em',
                    height: '1em',
                    fill: 'currentColor',
                    'aria-hidden': 'true',
                    focusable: 'false',
                  },
                  [h('path', { d: resolvedPath })],
                ),
              ]
            : undefined,
      )
    }
  },
})

export const createFsusIcon = (iconName: FsusIconName, displayName?: string) =>
  defineComponent({
    name: displayName ?? `FsusIcon_${iconName}`,
    props: {
      size: { type: [Number, String] as PropType<number | string>, default: undefined },
      color: { type: String, default: undefined },
      spin: { type: Boolean, default: false },
      label: { type: String, default: undefined },
      decorative: { type: Boolean, default: undefined },
    },
    setup(props) {
      return () => h(FsusIcon, { ...props, name: iconName })
    },
  })

// Canonical named icons (zero-overhead thin wrappers around the shared path map)
export const FsusIconSearch = createFsusIcon('search', 'FsusIconSearch')
export const FsusIconClose = createFsusIcon('close', 'FsusIconClose')
export const FsusIconCircleClose = createFsusIcon('circle-close', 'FsusIconCircleClose')
export const FsusIconCircleCloseFilled = createFsusIcon('circle-close-filled', 'FsusIconCircleCloseFilled')
export const FsusIconCheck = createFsusIcon('check', 'FsusIconCheck')
export const FsusIconCircleCheck = createFsusIcon('circle-check', 'FsusIconCircleCheck')
export const FsusIconCircleCheckFilled = createFsusIcon('circle-check-filled', 'FsusIconCircleCheckFilled')
export const FsusIconLoading = createFsusIcon('loading', 'FsusIconLoading')
export const FsusIconArrowRight = createFsusIcon('arrow-right', 'FsusIconArrowRight')
export const FsusIconArrowLeft = createFsusIcon('arrow-left', 'FsusIconArrowLeft')
export const FsusIconArrowUp = createFsusIcon('arrow-up', 'FsusIconArrowUp')
export const FsusIconArrowDown = createFsusIcon('arrow-down', 'FsusIconArrowDown')
export const FsusIconDoubleLeft = createFsusIcon('d-arrow-left', 'FsusIconDoubleLeft')
export const FsusIconDoubleRight = createFsusIcon('d-arrow-right', 'FsusIconDoubleRight')
export const FsusIconCaretRight = createFsusIcon('caret-right', 'FsusIconCaretRight')
export const FsusIconCaretLeft = createFsusIcon('caret-left', 'FsusIconCaretLeft')
export const FsusIconCaretTop = createFsusIcon('caret-top', 'FsusIconCaretTop')
export const FsusIconCaretBottom = createFsusIcon('caret-bottom', 'FsusIconCaretBottom')
export const FsusIconPlus = createFsusIcon('plus', 'FsusIconPlus')
export const FsusIconMinus = createFsusIcon('minus', 'FsusIconMinus')
export const FsusIconWarning = createFsusIcon('warning', 'FsusIconWarning')
export const FsusIconWarningFilled = createFsusIcon('warning-filled', 'FsusIconWarningFilled')
export const FsusIconInfoFilled = createFsusIcon('info-filled', 'FsusIconInfoFilled')
export const FsusIconQuestionFilled = createFsusIcon('question-filled', 'FsusIconQuestionFilled')
export const FsusIconCalendar = createFsusIcon('calendar', 'FsusIconCalendar')
export const FsusIconClock = createFsusIcon('clock', 'FsusIconClock')
export const FsusIconView = createFsusIcon('view', 'FsusIconView')
export const FsusIconHide = createFsusIcon('hide', 'FsusIconHide')
export const FsusIconDelete = createFsusIcon('delete', 'FsusIconDelete')
export const FsusIconEdit = createFsusIcon('edit', 'FsusIconEdit')
export const FsusIconCopy = createFsusIcon('copy-document', 'FsusIconCopy')
export const FsusIconUpload = createFsusIcon('upload', 'FsusIconUpload')
export const FsusIconDownload = createFsusIcon('download', 'FsusIconDownload')
export const FsusIconZoomIn = createFsusIcon('zoom-in', 'FsusIconZoomIn')
export const FsusIconZoomOut = createFsusIcon('zoom-out', 'FsusIconZoomOut')
export const FsusIconFullScreen = createFsusIcon('full-screen', 'FsusIconFullScreen')
export const FsusIconScaleOriginal = createFsusIcon('scale-to-original', 'FsusIconScaleOriginal')
export const FsusIconRefreshLeft = createFsusIcon('refresh-left', 'FsusIconRefreshLeft')
export const FsusIconRefreshRight = createFsusIcon('refresh-right', 'FsusIconRefreshRight')
export const FsusIconBack = createFsusIcon('back', 'FsusIconBack')
export const FsusIconStar = createFsusIcon('star', 'FsusIconStar')
export const FsusIconStarFilled = createFsusIcon('star-filled', 'FsusIconStarFilled')
export const FsusIconMore = createFsusIcon('more', 'FsusIconMore')
export const FsusIconMoreFilled = createFsusIcon('more-filled', 'FsusIconMoreFilled')
export const FsusIconSortUp = createFsusIcon('sort-up', 'FsusIconSortUp')
export const FsusIconSortDown = createFsusIcon('sort-down', 'FsusIconSortDown')
export const FsusIconSettings = createFsusIcon('setting', 'FsusIconSettings')
export const FsusIconMenu = createFsusIcon('menu', 'FsusIconMenu')
export const FsusIconFilter = createFsusIcon('filter', 'FsusIconFilter')
export const FsusIconFolder = createFsusIcon('folder', 'FsusIconFolder')
export const FsusIconFolderOpened = createFsusIcon('folder-opened', 'FsusIconFolderOpened')
export const FsusIconDocument = createFsusIcon('document', 'FsusIconDocument')
export const FsusIconFile = createFsusIcon('file', 'FsusIconFile')
export const FsusIconMoon = createFsusIcon('moon', 'FsusIconMoon')
export const FsusIconSun = createFsusIcon('sunny', 'FsusIconSun')
export const FsusIconMonitor = createFsusIcon('monitor', 'FsusIconMonitor')
export const FsusIconPicture = createFsusIcon('picture-filled', 'FsusIconPicture')
export const FsusIconBell = createFsusIcon('bell', 'FsusIconBell')
export const FsusIconLock = createFsusIcon('lock', 'FsusIconLock')
export const FsusIconUnlock = createFsusIcon('unlock', 'FsusIconUnlock')
export const FsusIconLink = createFsusIcon('link', 'FsusIconLink')
export const FsusIconPaperclip = createFsusIcon('paperclip', 'FsusIconPaperclip')
