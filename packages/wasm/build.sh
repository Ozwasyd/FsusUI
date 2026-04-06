#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# FsusUI WASM 构建脚本
# 依赖：emsdk 已安装并激活（环境变量 EMSDK 已设置）
# 用法：
#   bash packages/wasm/build.sh          # Release 构建
#   bash packages/wasm/build.sh --debug  # Debug 构建（含 sourcemap）
# ─────────────────────────────────────────────────────────
set -euo pipefail

# Ensure ~/.local/bin is in PATH (for ninja installed via pip)
export PATH="$HOME/.local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
DIST_DIR="${SCRIPT_DIR}/dist"
DEBUG_MODE=false

for arg in "$@"; do
  [[ "$arg" == "--debug" ]] && DEBUG_MODE=true
done

# ── 激活 emsdk（如果 emcc 不在 PATH 中）──────────────────
if ! command -v emcc &>/dev/null; then
  if [[ -n "${EMSDK:-}" ]]; then
    # shellcheck source=/dev/null
    source "${EMSDK}/emsdk_env.sh"
  else
    echo "错误: emcc 未找到。请先安装并激活 emsdk：" >&2
    echo "  git clone https://github.com/emscripten-core/emsdk.git" >&2
    echo "  cd emsdk && ./emsdk install latest && ./emsdk activate latest" >&2
    echo "  source emsdk_env.sh" >&2
    exit 1
  fi
fi

echo "emcc 版本: $(emcc --version | head -1)"

mkdir -p "${BUILD_DIR}" "${DIST_DIR}"
cd "${BUILD_DIR}"

# ── CMake 配置 ────────────────────────────────────────────
BUILD_TYPE="Release"
$DEBUG_MODE && BUILD_TYPE="Debug"

emcmake cmake "${SCRIPT_DIR}" \
  -DCMAKE_BUILD_TYPE="${BUILD_TYPE}" \
  -G Ninja

# ── 编译 ──────────────────────────────────────────────────
cmake --build . --config "${BUILD_TYPE}" --parallel "$(nproc)"

# ── 产物已输出到 dist/ by RUNTIME_OUTPUT_DIRECTORY ────────
# Emscripten 以 .js 输出 glue，重命名为 .mjs 供 ESM 导入
if [[ -f "${DIST_DIR}/ep_wasm.js" ]]; then
  mv -f "${DIST_DIR}/ep_wasm.js" "${DIST_DIR}/ep_wasm.mjs"
elif [[ -f ep_wasm.mjs ]]; then
  cp -f ep_wasm.mjs  "${DIST_DIR}/ep_wasm.mjs"
fi
[[ -f ep_wasm.wasm ]] && cp -f ep_wasm.wasm "${DIST_DIR}/ep_wasm.wasm"

$DEBUG_MODE && [[ -f ep_wasm.wasm.map ]] && \
  cp -f ep_wasm.wasm.map "${DIST_DIR}/ep_wasm.wasm.map"

echo ""
echo "✓ WASM 构建完成 → packages/wasm/dist/"
ls -lh "${DIST_DIR}"
