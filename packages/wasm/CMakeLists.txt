cmake_minimum_required(VERSION 3.27)
project(ep_wasm LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Emscripten 工具链标志（必须通过 emcmake cmake 调用）
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "必须使用 Emscripten 工具链: emcmake cmake .")
endif()

add_executable(ep_wasm src/ep_wasm.cpp)

# ── Emscripten 链接选项 ──────────────────────────────────
target_link_options(ep_wasm PRIVATE
  # 使用 embind，支持 ES Module 输出
  "-lembind"

  # 输出为 ES Module（.mjs）
  "-sENVIRONMENT=web,worker"
  "-sEXPORT_ES6=1"
  "-sMODULARIZE=1"
  "-sEXPORT_NAME=createEpWasm"

  # 内存配置：初始 4 MB，最大 256 MB，允许增长
  "-sINITIAL_MEMORY=4MB"
  "-sMAXIMUM_MEMORY=256MB"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sSTACK_SIZE=1MB"

  # 优化：O3 + SIMD（ES2022 目标浏览器均支持）
  "-O3"
  "-msimd128"

  # 关闭 Emscripten 异常（使用 C++ 原生异常）
  "-sDISABLE_EXCEPTION_CATCHING=0"

  # 输出文件名
  "-o" "${CMAKE_CURRENT_BINARY_DIR}/ep_wasm.mjs"
)

target_compile_options(ep_wasm PRIVATE
  "-O3"
  "-std=c++23"
  "-msimd128"
  # 严格模式编译
  "-Wall"
  "-Wextra"
)

# 设置输出到 dist/ 目录
set_target_properties(ep_wasm PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/dist"
)
