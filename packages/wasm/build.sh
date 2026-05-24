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

# ── 激活 emsdk。优先使用项目/用户安装的 emsdk，避免误用系统旧版 emcc。────
if [[ -n "${EMSDK:-}" && -f "${EMSDK}/emsdk_env.sh" ]]; then
  export EMSDK_QUIET="${EMSDK_QUIET:-1}"
  # shellcheck source=/dev/null
  source "${EMSDK}/emsdk_env.sh"
elif [[ -f "${HOME}/.cache/emsdk/emsdk_env.sh" ]]; then
  export EMSDK_QUIET="${EMSDK_QUIET:-1}"
  # shellcheck source=/dev/null
  source "${HOME}/.cache/emsdk/emsdk_env.sh"
fi

if ! command -v emcc &>/dev/null; then
  echo "错误: emcc 未找到。请先安装并激活 emsdk：" >&2
  echo "  git clone https://github.com/emscripten-core/emsdk.git" >&2
  echo "  cd emsdk && ./emsdk install latest && ./emsdk activate latest" >&2
  echo "  source emsdk_env.sh" >&2
  exit 1
fi

echo "emcc 版本: $(emcc --version | head -1)"

detect_jobs() {
  if [[ -n "${WASM_BUILD_JOBS:-}" ]]; then
    echo "${WASM_BUILD_JOBS}"
    return
  fi

  if command -v nproc &>/dev/null; then
    nproc
  elif command -v sysctl &>/dev/null; then
    sysctl -n hw.ncpu
  else
    echo "2"
  fi
}

BUILD_JOBS="$(detect_jobs)"
if ! [[ "${BUILD_JOBS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "错误: WASM_BUILD_JOBS 必须是正整数，当前值: ${BUILD_JOBS}" >&2
  exit 1
fi

mkdir -p "${BUILD_DIR}" "${DIST_DIR}"
rm -f "${DIST_DIR}/ep_wasm.js"
cd "${BUILD_DIR}"

# ── CMake 配置 ────────────────────────────────────────────
BUILD_TYPE="Release"
$DEBUG_MODE && BUILD_TYPE="Debug"

emcmake cmake "${SCRIPT_DIR}" \
  -DCMAKE_BUILD_TYPE="${BUILD_TYPE}" \
  -G Ninja

# ── 编译 ──────────────────────────────────────────────────
cmake --build . --config "${BUILD_TYPE}" --parallel "${BUILD_JOBS}"

if [[ ! -f "${DIST_DIR}/ep_wasm.mjs" ]]; then
  echo "错误: WASM glue 产物缺失: ${DIST_DIR}/ep_wasm.mjs" >&2
  exit 1
fi

if [[ ! -f "${DIST_DIR}/ep_wasm.wasm" ]]; then
  echo "错误: WASM binary 产物缺失: ${DIST_DIR}/ep_wasm.wasm" >&2
  exit 1
fi

for artifact in \
  markdown_basic.js \
  markdown_basic.wasm \
  markdown_simd.js \
  markdown_simd.wasm; do
  if [[ ! -f "${DIST_DIR}/${artifact}" ]]; then
    echo "错误: Markdown WASM 产物缺失: ${DIST_DIR}/${artifact}" >&2
    exit 1
  fi
done

if ${DEBUG_MODE} && [[ -f ep_wasm.wasm.map && ! -f "${DIST_DIR}/ep_wasm.wasm.map" ]]; then
  cp -f ep_wasm.wasm.map "${DIST_DIR}/ep_wasm.wasm.map"
fi

echo ""
echo "✓ WASM 构建完成 → packages/wasm/dist/ (jobs=${BUILD_JOBS})"
ls -lh "${DIST_DIR}"
