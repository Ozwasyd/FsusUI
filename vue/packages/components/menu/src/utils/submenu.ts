import { triggerEvent } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import type MenuItem from './menu-item'

class SubMenu {
  public parent: MenuItem
  public domNode: ParentNode
  public subMenuItems!: NodeListOf<HTMLElement>
  public subIndex = 0
  constructor(parent: MenuItem, domNode: ParentNode) {
    this.parent = parent
    this.domNode = domNode
    this.subIndex = 0
    this.init()
  }

  init(): void {
    this.subMenuItems = this.domNode.querySelectorAll<HTMLElement>('li')
    this.addListeners()
  }

  gotoSubIndex(idx: number): void {
    if (idx === this.subMenuItems.length) {
      idx = 0
    } else if (idx < 0) {
      idx = this.subMenuItems.length - 1
    }
    this.subMenuItems[idx]?.focus()
    this.subIndex = idx
  }

  addListeners(): void {
    const parentNode = this.parent.domNode
    this.subMenuItems.forEach((el) => {
      el.addEventListener('keydown', (event: KeyboardEvent) => {
        let prevDef = false
        switch (event.code) {
          case EVENT_CODE.down: {
            this.gotoSubIndex(this.subIndex + 1)
            prevDef = true
            break
          }
          case EVENT_CODE.up: {
            this.gotoSubIndex(this.subIndex - 1)
            prevDef = true
            break
          }
          case EVENT_CODE.tab: {
            triggerEvent(parentNode as HTMLElement, 'mouseleave')
            break
          }
          case EVENT_CODE.enter:
          case EVENT_CODE.space: {
            prevDef = true
            ;(event.currentTarget as HTMLElement | null)?.click()
            break
          }
        }
        if (prevDef) {
          event.preventDefault()
          event.stopPropagation()
        }
        return false
      })
    })
  }
}

export default SubMenu
