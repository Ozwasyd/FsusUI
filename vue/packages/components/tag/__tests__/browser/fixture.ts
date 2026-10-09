import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { ElConfigProvider, ElIcon, ElTag } from '@ozwasyd/element-plus'
import English from '@element-plus/locale/lang/en'
import Chinese from '@element-plus/locale/lang/zh-cn'
import { Close } from '@element-plus/icons-vue'
import '@element-plus/theme-chalk/src/fsus.scss'

const labels = [
  '状态 APIv2',
  '分类 APIv2-' + 'UnbrokenCategory'.repeat(16),
  '定时发布等待索引同步'.repeat(12),
  'بانتظار النشر ومزامنة الفهرس '.repeat(12),
  '',
]
const state = ref({
  multiline: false,
  size: 'small',
  effect: 'light',
  type: 'warning',
  disableTransitions: true,
  closable: false,
  dir: 'ltr',
  icon: false,
  locale: 'en',
})
const events: string[] = []
const Fixture = defineComponent({
  setup() {
    return () =>
      h(
        'main',
        {
          style:
            'width:100%;display:flex;flex-wrap:wrap;align-items:flex-start',
          dir: state.value.dir,
        },
        [
          ...labels.map((label, index) =>
            h(
              'div',
              {
                'data-case': index,
                style:
                  'width:100%;min-width:0;display:flex;margin-block-end:8px',
              },
              [
                h(
                  ElTag,
                  {
                    ...state.value,
                    'data-tag': index,
                    onClick: () => events.push('click'),
                    onClose: (event: MouseEvent) =>
                      events.push(
                        event instanceof MouseEvent ? 'close' : 'invalid-close',
                      ),
                  },
                  () => [
                    state.value.icon
                      ? h(ElIcon, { 'data-slot-icon': '' }, () => h(Close))
                      : null,
                    label,
                  ],
                ),
              ],
            ),
          ),
          h(
            'div',
            {
              'data-baseline-boundary': '',
              style: 'display:flex;min-width:0;width:100%',
            },
            [
              h(
                ElTag,
                {
                  size: 'small',
                  disableTransitions: true,
                  style: 'min-width:0;max-width:100%',
                },
                () =>
                  h(
                    'span',
                    {
                      style:
                        'min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere',
                    },
                    labels[1],
                  ),
              ),
            ],
          ),
        ],
      )
  },
})
createApp(
  defineComponent({
    setup() {
      return () =>
        h(
          ElConfigProvider,
          {
            locale: state.value.locale === 'zh-cn' ? Chinese : English,
          },
          () => h(Fixture),
        )
    },
  }),
).mount('#app')
Object.assign(window, {
  tagFixture: {
    labels,
    events,
    async set(patch: Partial<typeof state.value>) {
      state.value = { ...state.value, ...patch }
      events.length = 0
      await nextTick()
    },
  },
})
