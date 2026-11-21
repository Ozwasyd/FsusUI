#include "markdown_contract.hpp"
#include <cstdlib>
#include <cstdint>
#include <vector>

namespace {
std::vector<std::uint32_t> g_rows;
}
extern "C" {
void* fa_alloc(int size) { return std::malloc(static_cast<std::size_t>(size)); }
void fa_free(void* ptr) { std::free(ptr); }
const std::uint32_t* fa_data() { return g_rows.data(); }
int fa_collect(const char* source, int size) {
  if (!source || size < 0) return -1;
  const auto owners = fsusblog::wasm::markdown::collect_anchor_owner_blocks(
    std::string_view(source, static_cast<std::size_t>(size)));
  g_rows.clear();
  g_rows.reserve(owners.size() * 3);
  for (const auto& owner : owners) {
    g_rows.push_back(static_cast<std::uint32_t>(owner.kind));
    g_rows.push_back(static_cast<std::uint32_t>(owner.range.start_offset));
    g_rows.push_back(static_cast<std::uint32_t>(owner.range.end_offset));
  }
  return static_cast<int>(owners.size());
}
}
