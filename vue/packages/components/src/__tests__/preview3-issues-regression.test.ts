import { describe, expect, it, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  FsusDialog,
  FsusDrawer,
  FsusInput,
  FsusMessageBox,
} from '../index'

describe('preview.3 issue regressions (#1154, #1155, #1156)', () => {
  const mountedWrappers: Array<{ unmount: () => void }> = []

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount()
    }
    document.body.innerHTML = ''
  })

  it('#1154: FsusInput accepts explicit id prop and renders one native id on <input>/<textarea>', () => {
    const inputWrapper = mount(FsusInput, {
      props: { id: 'email', type: 'email' },
    })
    expect(inputWrapper.attributes('id')).toBeUndefined()
    expect(inputWrapper.find('input').attributes('id')).toBe('email')
    expect(inputWrapper.element.querySelectorAll('[id="email"]')).toHaveLength(1)

    const textareaWrapper = mount(FsusInput, {
      props: { id: 'bio', type: 'textarea' },
    })
    expect(textareaWrapper.attributes('id')).toBeUndefined()
    expect(textareaWrapper.find('textarea').attributes('id')).toBe('bio')
  })

  it('#1155: FsusMessageBox links alertdialog aria-labelledby and aria-describedby to title and message', async () => {
    const pending = FsusMessageBox.confirm('Remove the document?', 'Delete document')
    await nextTick()

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')

    const labelledBy = dialog?.getAttribute('aria-labelledby')
    const describedBy = dialog?.getAttribute('aria-describedby')
    expect(labelledBy).toBeTruthy()
    expect(describedBy).toBeTruthy()

    const heading = document.getElementById(labelledBy!)
    const desc = document.getElementById(describedBy!)
    expect(heading?.tagName).toBe('H2')
    expect(heading?.textContent).toBe('Delete document')
    expect(desc?.textContent).toBe('Remove the document?')

    // Dismiss cleanly
    const buttons = Array.from(dialog!.querySelectorAll<HTMLButtonElement>('button'))
    buttons[0]!.click()
    const outcome = await pending
    expect(outcome.ok).toBe(false)

    // Title-less open() still receives an accessible fallback aria-label and description
    const pendingUntitled = FsusMessageBox.open({ message: 'Proceed without title?', mode: 'confirm' })
    await nextTick()
    const untitledDialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]')
    expect(untitledDialog?.getAttribute('aria-labelledby')).toBeNull()
    expect(untitledDialog?.getAttribute('aria-label')).toBe('Confirm')
    const untitledDescId = untitledDialog?.getAttribute('aria-describedby')
    expect(untitledDescId).toBeTruthy()
    expect(document.getElementById(untitledDescId!)?.textContent).toBe('Proceed without title?')

    const confirmBtn = Array.from(untitledDialog!.querySelectorAll<HTMLButtonElement>('button')).at(-1)!
    confirmBtn.click()
    const confirmed = await pendingUntitled
    expect(confirmed.ok).toBe(true)
  })

  it('#1156: one Escape closes only the topmost nested FsusDialog across all four Drawer mount/guard combinations and restores focus', async () => {
    const scenarios = [
      { name: 'v-if mounted open + guarded', conditionalMount: true, guardParent: true },
      { name: 'v-if mounted open + always true', conditionalMount: true, guardParent: false },
      { name: 'pre-mounted closed + guarded', conditionalMount: false, guardParent: true },
      { name: 'pre-mounted closed + always true', conditionalMount: false, guardParent: false },
    ] as const

    for (const scenario of scenarios) {
      const Host = defineComponent({
        setup() {
          const mounted = ref(!scenario.conditionalMount)
          const drawerOpen = ref(false)
          const comparisonOpen = ref(false)
          const openDrawer = () => {
            mounted.value = true
            drawerOpen.value = true
          }
          return { mounted, drawerOpen, comparisonOpen, openDrawer }
        },
        render() {
          return h('div', [
            h('button', { id: 'launch', type: 'button', onClick: this.openDrawer }, 'Open drawer'),
            this.mounted
              ? h(
                  FsusDrawer,
                  {
                    open: this.drawerOpen,
                    'onUpdate:open': (v: boolean) => (this.drawerOpen = v),
                    title: 'Parent',
                    closeOnEscape: scenario.guardParent ? !this.comparisonOpen : true,
                  },
                  {
                    default: () => [
                      h(
                        'button',
                        {
                          id: 'compare',
                          type: 'button',
                          onClick: () => (this.comparisonOpen = true),
                        },
                        'Open dialog',
                      ),
                      h(
                        FsusDialog,
                        {
                          open: this.comparisonOpen,
                          'onUpdate:open': (v: boolean) => (this.comparisonOpen = v),
                          title: 'Child',
                          destroyOnClose: true,
                        },
                        {
                          default: () =>
                            h('textarea', {
                              id: 'child-source',
                              'aria-label': 'Source',
                              readonly: true,
                            }, 'Public demonstration source.'),
                        },
                      ),
                    ],
                  },
                )
              : null,
          ])
        },
      })

      const wrapper = mount(Host, { attachTo: document.body })
      mountedWrappers.push(wrapper)

      // 1. Open drawer
      const launch = document.getElementById('launch') as HTMLButtonElement
      launch.focus()
      launch.click()
      await nextTick()
      await Promise.resolve()
      expect(wrapper.vm.drawerOpen).toBe(true)

      // 2. Open nested dialog from #compare
      const compare = document.getElementById('compare') as HTMLButtonElement
      compare.focus()
      compare.click()
      await nextTick()
      await Promise.resolve()
      expect(wrapper.vm.comparisonOpen).toBe(true)

      // 3. Focus child textarea and press Escape ONCE
      const textarea = document.getElementById('child-source') as HTMLTextAreaElement
      expect(textarea).not.toBeNull()
      textarea.focus()
      expect(document.activeElement).toBe(textarea)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await nextTick()
      await Promise.resolve()

      // Only child dialog closes; parent drawer stays open and focus returns to #compare
      expect(wrapper.vm.comparisonOpen, `${scenario.name}: child dialog should close`).toBe(false)
      expect(wrapper.vm.drawerOpen, `${scenario.name}: parent drawer must stay open`).toBe(true)
      expect(document.activeElement, `${scenario.name}: focus must return to #compare`).toBe(compare)

      // 4. Second Escape closes parent drawer and restores focus to #launch
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await nextTick()
      await Promise.resolve()
      expect(wrapper.vm.drawerOpen, `${scenario.name}: second Escape should close drawer`).toBe(false)
      expect(document.activeElement, `${scenario.name}: focus must return to #launch`).toBe(launch)

      wrapper.unmount()
      mountedWrappers.pop()
      document.body.innerHTML = ''
    }
  })

  it('#1156: top FsusDialog with closeOnEscape=false blocks Escape without closing parent FsusDrawer', async () => {
    const Host = defineComponent({
      setup() {
        const drawerOpen = ref(true)
        const dialogOpen = ref(false)
        return { drawerOpen, dialogOpen }
      },
      render() {
        return h(
          FsusDrawer,
          {
            open: this.drawerOpen,
            'onUpdate:open': (v: boolean) => (this.drawerOpen = v),
            title: 'Parent',
            closeOnEscape: true,
          },
          {
            default: () => [
              h('button', { id: 'open-locked', onClick: () => (this.dialogOpen = true) }, 'Open'),
              h(
                FsusDialog,
                {
                  open: this.dialogOpen,
                  'onUpdate:open': (v: boolean) => (this.dialogOpen = v),
                  title: 'Locked Child',
                  closeOnEscape: false,
                },
                { default: () => h('p', 'Locked') },
              ),
            ],
          },
        )
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    mountedWrappers.push(wrapper)
    await nextTick()

    wrapper.vm.dialogOpen = true
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.vm.dialogOpen).toBe(true)
    expect(wrapper.vm.drawerOpen).toBe(true)
  })
})
