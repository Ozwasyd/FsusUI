import { makeInstaller } from './make-installer'
import Components, { componentGroups } from './component'
import Plugins from './plugin'

export default makeInstaller([...Components, ...Plugins])
export const groupedInstaller = {
  core: makeInstaller([...componentGroups.core]),
  optional: makeInstaller([...componentGroups.optional]),
  advanced: makeInstaller([...componentGroups.advanced, ...Plugins]),
}
