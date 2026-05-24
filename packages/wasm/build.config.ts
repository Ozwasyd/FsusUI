import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['index'],
  declaration: true,
  failOnWarn: false,
  clean: false,
  rollup: {
    emitCJS: true,
    output: {
      exports: 'named',
    },
  },
  externals: [
    '@element-plus/utils',
    // WASM glue 作为外部资源，由 Vite/打包器处理
    './ep_wasm.mjs',
  ],
})
