import { createApp, h, ref } from 'vue'
import { ElDrawer } from 'element-plus'
import '@element-plus/theme-chalk/src/fsus.scss'

// Isolated public API fixture. No component selectors or geometry overrides.
const params = new URLSearchParams(window.location.search)
const direction = params.get('direction') ?? 'ltr'
const size = params.get('size') ?? 'min(86vw, 22rem)'
const destroyOnClose = params.get('destroy') === 'true'
document.documentElement.classList.toggle(
  'dark',
  params.get('theme') === 'dark',
)

createApp({
  setup() {
    const visible = ref(false)
    const events = ref<string[]>([])
    const navigations = ref(0)
    return () => [
      h(
        'button',
        { id: 'open', onClick: () => (visible.value = true) },
        'Open account',
      ),
      h('input', { id: 'outside', 'aria-label': 'Outside drawer' }),
      h('output', { id: 'events' }, events.value.join(',')),
      h('output', { id: 'navigations' }, navigations.value),
      h(
        ElDrawer,
        {
          modelValue: visible.value,
          'onUpdate:modelValue': (value: boolean) => (visible.value = value),
          direction: direction as 'ltr' | 'rtl' | 'ttb' | 'btt',
          size,
          destroyOnClose,
          appendToBody: true,
          onOpen: () => events.value.push('open'),
          onOpened: () => events.value.push('opened'),
          onClose: () => events.value.push('close'),
          onClosed: () => events.value.push('closed'),
        },
        {
          header: ({
            titleId,
            titleClass,
          }: {
            titleId: string
            titleClass: string
          }) =>
            h(
              'span',
              {
                id: titleId,
                class: titleClass,
                role: 'heading',
                'aria-level': '2',
              },
              'Account',
            ),
          default: () =>
            h(
              'a',
              {
                id: 'account-link',
                href: '#profile',
                style: { display: 'block', lineHeight: '44px' },
                onClick: (event: MouseEvent) => {
                  event.preventDefault()
                  navigations.value++
                },
              },
              'Account profile',
            ),
        },
      ),
    ]
  },
}).mount('#app')
