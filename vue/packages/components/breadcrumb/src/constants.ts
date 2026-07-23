import type { InjectionKey, Ref } from 'vue'
import type { BreadcrumbProps } from './breadcrumb'

export interface BreadcrumbItemState {
  uid: number
  interactive: boolean
  label: string
  navigate: () => void
}

export interface BreadcrumbContext {
  props: BreadcrumbProps
  items: Ref<BreadcrumbItemState[]>
  addItem: (item: BreadcrumbItemState) => void
  removeItem: (uid: number) => void
}

export const breadcrumbKey: InjectionKey<BreadcrumbContext> =
  Symbol('breadcrumbKey')
