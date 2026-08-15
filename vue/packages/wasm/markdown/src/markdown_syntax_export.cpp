#include "markdown_contract.hpp"

#include <cstdlib>
#include <string>

namespace {

std::string g_syntax_json;

void append_json_string(std::string& out, std::string_view value) {
  out.push_back('"');
  for (const char ch : value) {
    if (ch == '"' || ch == '\\') {
      out.push_back('\\');
    }
    out.push_back(ch);
  }
  out.push_back('"');
}

} // namespace

extern "C" {

void* markdown_syntax_alloc(int size) {
  return std::malloc(static_cast<std::size_t>(size));
}

void markdown_syntax_free(void* pointer) {
  std::free(pointer);
}

int markdown_syntax_collect(const char* source_ptr, int source_len) {
  if (source_ptr == nullptr || source_len < 0) {
    g_syntax_json = "[]";
    return 0;
  }

  const std::string source(source_ptr, source_ptr + source_len);
  const std::string normalized = fsusblog::wasm::markdown::normalize_source(source);
  const auto nodes = fsusblog::wasm::markdown::collect_syntax_nodes(normalized);

  g_syntax_json.clear();
  g_syntax_json.push_back('[');
  bool first = true;
  for (const auto& node : nodes) {
    if (!first) {
      g_syntax_json.push_back(',');
    }
    first = false;
    g_syntax_json.append("{\"kind\":");
    append_json_string(g_syntax_json, fsusblog::wasm::markdown::syntax_kind_name(node.kind));
    g_syntax_json.append(",\"start\":");
    g_syntax_json.append(std::to_string(node.start_offset));
    g_syntax_json.append(",\"end\":");
    g_syntax_json.append(std::to_string(node.end_offset));
    g_syntax_json.push_back('}');
  }
  g_syntax_json.push_back(']');
  return 1;
}

const char* markdown_syntax_json_ptr() {
  return g_syntax_json.c_str();
}

int markdown_syntax_json_len() {
  return static_cast<int>(g_syntax_json.size());
}

}
