#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${EMSDK:-}" && -f "${EMSDK}/emsdk_env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${EMSDK}/emsdk_env.sh"
fi
em++ -std=c++23 -O2 \
  -I "${SCRIPT_DIR}/include" \
  "${SCRIPT_DIR}/src/markdown_contract.cpp" \
  "${SCRIPT_DIR}/src/markdown_latex.cpp" \
  "${SCRIPT_DIR}/src/markdown_mermaid.cpp" \
  "${SCRIPT_DIR}/src/markdown_syntax_export.cpp" \
  -fno-exceptions -fno-rtti \
  -sSTANDALONE_WASM=1 \
  -sEXPORTED_FUNCTIONS=_markdown_syntax_alloc,_markdown_syntax_free,_markdown_syntax_collect,_markdown_syntax_json_ptr,_markdown_syntax_json_len,_markdown_syntax_kinds_json_ptr,_markdown_syntax_kinds_json_len \
  -sALLOW_MEMORY_GROWTH=1 \
  --no-entry \
  -o "${SCRIPT_DIR}/syntax-collect.wasm"
node "${SCRIPT_DIR}/generate-syntax-collect-module.mjs"
