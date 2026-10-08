const { createJiti } = require("../../../../node_modules/jiti/lib/jiti.cjs")

const jiti = createJiti(__filename, {
  "interopDefault": true,
  "alias": {
    "@element-plus/wasm": "/workspace/FsusUI-828-geometry/vue/packages/wasm"
  },
  "transformOptions": {
    "babel": {
      "plugins": []
    }
  }
})

/** @type {import("/workspace/FsusUI-828-geometry/vue/packages/wasm/index.js")} */
module.exports = jiti("/workspace/FsusUI-828-geometry/vue/packages/wasm/index.ts")