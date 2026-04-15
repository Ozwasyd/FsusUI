import { computed, defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDraggable } from '../use-draggable'

const DraggableComp = defineComponent({
  setup() {
    const targetRef = ref<HTMLElement>()
    const dragRef = ref<HTMLElement>()

    useDraggable(
      targetRef,
      dragRef,
      computed(() => true),
    )

    return {
      targetRef,
      dragRef,
    }
  },
  render() {
    return (
      <div ref="targetRef" class="target">
        <button ref="dragRef" class="handle" type="button">
          drag
        </button>
      </div>
    )
  },
})

describe('useDraggable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('should remove document listeners when unmounted during drag', async () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const wrapper = mount(DraggableComp, {
      attachTo: document.body,
    })

    await nextTick()
    await wrapper.find('.handle').trigger('mousedown', {
      clientX: 10,
      clientY: 10,
    })

    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    )
  })

  it('should ignore nested interactive controls inside the drag handle', async () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    const wrapper = mount(
      defineComponent({
        setup() {
          const targetRef = ref<HTMLElement>()
          const dragRef = ref<HTMLElement>()

          useDraggable(
            targetRef,
            dragRef,
            computed(() => true),
          )

          return {
            targetRef,
            dragRef,
          }
        },
        render() {
          return (
            <div ref="targetRef" class="target">
              <div ref="dragRef" class="header">
                <button class="close" type="button">
                  close
                </button>
              </div>
            </div>
          )
        },
      }),
      {
        attachTo: document.body,
      },
    )

    await nextTick()
    await wrapper.find('.close').trigger('mousedown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    )
    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    )
  })
})
