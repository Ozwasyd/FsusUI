#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -gt 1 || ($# -eq 1 && "$1" != "--check") ]]; then
  echo "usage: $0 [--check]" >&2
  exit 2
fi

if [[ -n "${EMSDK:-}" && -f "${EMSDK}/emsdk_env.sh" ]]; then
  export EMSDK_QUIET="${EMSDK_QUIET:-1}"
  # shellcheck source=/dev/null
  source "${EMSDK}/emsdk_env.sh"
elif [[ -f "${HOME}/.cache/emsdk/emsdk_env.sh" ]]; then
  export EMSDK_QUIET="${EMSDK_QUIET:-1}"
  # shellcheck source=/dev/null
  source "${HOME}/.cache/emsdk/emsdk_env.sh"
fi

em_version="$(em++ --version)"
if [[ ! "$em_version" =~ 5\.0\.4[[:space:]] ]]; then
  echo "The anchor owner generator requires Emscripten 5.0.4" >&2
  exit 1
fi
binaryen="${EMSDK:+${EMSDK}/upstream/bin/}wasm2js"
if ! command -v "$binaryen" >/dev/null; then
  echo "The anchor owner generator requires wasm2js from Emscripten 5.0.4" >&2
  exit 1
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/fsus-anchor-owner.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
em++ -std=c++23 -Oz -flto -fno-exceptions -fno-rtti \
  -I "${SCRIPT_DIR}/include" \
  "${SCRIPT_DIR}/src/markdown_contract.cpp" \
  "${SCRIPT_DIR}/src/markdown_anchor_owner_export.cpp" \
  -sSTANDALONE_WASM=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=1048576 \
  -sEXPORTED_FUNCTIONS=_fa_alloc,_fa_free,_fa_data,_fa_collect \
  --no-entry -o "$work/owner.wasm"
"$binaryen" --all-features "$work/owner.wasm" -O3 -o "$work/owner.mjs"
node "${SCRIPT_DIR}/generate-anchor-owner-module.mjs" \
  "$work/owner.wasm" "$work/owner.mjs" "$work/anchor-owner.portable.mjs"

output="${SCRIPT_DIR}/anchor-owner.portable.mjs"
if [[ ${1:-} == "--check" ]]; then
  if ! cmp -s "$work/anchor-owner.portable.mjs" "$output"; then
    echo "Stale anchor owner module; run bash vue/packages/wasm/markdown/build-anchor-owner.sh" >&2
    exit 1
  fi
else
  cp "$work/anchor-owner.portable.mjs" "$output"
fi
