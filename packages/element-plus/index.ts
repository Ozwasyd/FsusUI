import installer from './defaults'
export * from '@element-plus/components'
export * from '@element-plus/constants'
export * from '@element-plus/directives'
export * from '@element-plus/hooks'
export * from './make-installer'
export * from './render-pipeline-policies'
export * from './result'

export const install = installer.install
export const version = installer.version
export { groupedInstaller } from './defaults'
export default installer

export { default as dayjs } from 'dayjs'
