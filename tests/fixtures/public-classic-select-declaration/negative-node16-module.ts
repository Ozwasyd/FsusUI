import CjsSelectModule, { type ElSelect } from '@ozwasyd/element-plus/lib/components/select'
import type { App } from 'vue'

declare const app: App
const moduleIsComponent: typeof ElSelect = CjsSelectModule
CjsSelectModule.install(app)
void moduleIsComponent
