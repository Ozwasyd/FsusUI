// Compile-only contracts: named declaration inputs must preserve the types
// inferred from the real install helpers and real component owners.
import Button from '@element-plus/components/button/src/button.vue'
import ButtonGroup from '@element-plus/components/button/src/button-group.vue'
import SplitPane from '@element-plus/components/inbox-primitives/src/split-pane.vue'
import { withInstall, withNoopInstall } from '../../vue/install'

type Assert<T extends true> = T
type IsAny<T> = 0 extends 1 & T ? true : false
type Compatible<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false

const bare = withInstall(Button)
type NamedBare = ReturnType<
  typeof withInstall<
    typeof Button,
    NonNullable<Parameters<typeof withInstall>[1]>
  >
>
const grouped = withInstall(Button, { ButtonGroup })
type NamedGrouped = ReturnType<
  typeof withInstall<typeof Button, { ButtonGroup: typeof ButtonGroup }>
>
const noop = withNoopInstall(ButtonGroup)
type NamedNoop = ReturnType<typeof withNoopInstall<typeof ButtonGroup>>

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})
const aliased = withInstall(SplitPane, {
  FsusSplitPane: withFsusAlias(SplitPane, 'FsusSplitPane'),
})
type NamedAliased = ReturnType<
  typeof withInstall<
    typeof SplitPane,
    {
      FsusSplitPane: ReturnType<typeof withFsusAlias<typeof SplitPane>>
    }
  >
>

export type InstallTypeCompatibility = [
  Assert<Compatible<typeof bare, NamedBare>>,
  Assert<Compatible<typeof grouped, NamedGrouped>>,
  Assert<Compatible<typeof noop, NamedNoop>>,
  Assert<Compatible<typeof aliased, NamedAliased>>,
  Assert<Compatible<typeof grouped.ButtonGroup, NamedGrouped['ButtonGroup']>>,
  Assert<
    Compatible<typeof aliased.FsusSplitPane, NamedAliased['FsusSplitPane']>
  >,
  Assert<
    Compatible<
      InstanceType<typeof grouped>['$props'],
      InstanceType<NamedGrouped>['$props']
    >
  >,
  Assert<
    Compatible<
      InstanceType<typeof grouped>['$slots'],
      InstanceType<NamedGrouped>['$slots']
    >
  >,
  Assert<Compatible<typeof grouped.install, NamedGrouped['install']>>,
  Assert<Compatible<IsAny<NamedBare>, false>>,
  Assert<Compatible<IsAny<NamedGrouped>, false>>,
  Assert<Compatible<IsAny<NamedNoop>, false>>,
  Assert<Compatible<IsAny<NamedAliased>, false>>,
]
