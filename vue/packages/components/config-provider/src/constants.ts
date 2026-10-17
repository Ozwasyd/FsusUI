import type { ConfigProviderProps } from './config-provider-props'
import type { InjectionKey, Ref } from 'vue'

export type ConfigProviderContext = Partial<ConfigProviderProps>

// Internal source-alias contract; this is not a package custody certificate.
export type GlobalConfigTicket<T> = {
  readonly contextIdentity: object
  readonly value: T
  readonly current: () => boolean
}

export type GlobalConfigFeed<T> = {
  readonly issueTicket: () => GlobalConfigTicket<T> | null
  readonly isCurrent: (ticket: unknown) => boolean
  readonly subscribe: (revoke: () => void) => () => void
  readonly getFailures: () => readonly unknown[]
}

export type GlobalConfigSnapshotProducer = {
  readonly config: Readonly<Ref<ConfigProviderContext>>
  readonly update: (next: ConfigProviderContext) => void
  readonly release: () => void
}

export const configProviderContextKey: InjectionKey<
  Ref<ConfigProviderContext>
> = Symbol()
