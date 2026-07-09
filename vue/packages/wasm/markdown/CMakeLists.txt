set(FSUSUI_MARKDOWN_SOURCES
  src/markdown_contract.cpp
  src/markdown_exports.cpp
  src/markdown_latex.cpp
  src/markdown_mermaid.cpp
)

function(add_fsusui_markdown_renderer target_name output_name enable_simd)
  add_executable(${target_name} ${FSUSUI_MARKDOWN_SOURCES})

  target_include_directories(${target_name}
    SYSTEM PRIVATE
      include
  )

  target_compile_features(${target_name} PRIVATE cxx_std_23)
  target_compile_options(${target_name} PRIVATE
    -O3
    -fno-exceptions
    -fno-rtti
    -fvisibility=hidden
  )

  if(${enable_simd})
    message(STATUS "Markdown wasm SIMD128 enabled for ${target_name}")
    target_compile_options(${target_name} PRIVATE -msimd128)
    target_link_options(${target_name} PRIVATE -msimd128)
  else()
    message(STATUS "Markdown wasm scalar fallback enabled for ${target_name}")
  endif()

  target_link_options(${target_name} PRIVATE
    --no-entry
    -sWASM=1
    -sALLOW_MEMORY_GROWTH=1
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sEXPORT_NAME=createMarkdownModule
    -sENVIRONMENT=web,worker,node
    -sEXPORTED_FUNCTIONS=["_alloc_buffer","_free_buffer","_render_markdown","_get_last_html_ptr","_get_last_html_len","_get_last_error_ptr","_get_last_error_len","_get_last_error_code","_get_last_features_ptr","_get_last_features_len","_get_last_placeholders_ptr","_get_last_placeholders_len","_get_last_chunks_ptr","_get_last_chunks_len","_get_last_renderer_version_ptr","_get_last_renderer_version_len","_get_last_metadata_ptr","_get_last_metadata_len","_markdown_alloc_buffer","_markdown_free_buffer","_markdown_render","_markdown_render_profile","_markdown_get_last_html_ptr","_markdown_get_last_html_len","_markdown_get_last_error_ptr","_markdown_get_last_error_len","_markdown_get_last_error_code","_markdown_get_last_features_ptr","_markdown_get_last_features_len","_markdown_get_last_placeholders_ptr","_markdown_get_last_placeholders_len","_markdown_get_last_chunks_ptr","_markdown_get_last_chunks_len","_markdown_get_last_renderer_version_ptr","_markdown_get_last_renderer_version_len","_markdown_get_last_metadata_ptr","_markdown_get_last_metadata_len"]
    -sEXPORTED_RUNTIME_METHODS=["UTF8ToString","HEAPU8"]
  )

  set_target_properties(${target_name} PROPERTIES
    OUTPUT_NAME "${output_name}"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/dist"
    SUFFIX ".js"
  )
endfunction()

add_fsusui_markdown_renderer(fsusui_markdown_basic markdown_basic OFF)
add_fsusui_markdown_renderer(fsusui_markdown_simd markdown_simd ON)
