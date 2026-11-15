// Exercise the private implementation without adding a public parser API.
#include "../src/markdown_contract.cpp"
#include <iostream>
#include <random>
#include <stdexcept>

using fsusblog::wasm::markdown::syntax_kind;
using fsusblog::wasm::markdown::syntax_node;

void check(std::vector<syntax_node> nodes) {
  std::stable_sort(nodes.begin(), nodes.end(), [](const auto& left, const auto& right) {
    if (left.start_offset != right.start_offset) return left.start_offset < right.start_offset;
    if (left.end_offset != right.end_offset) return left.end_offset > right.end_offset;
    return left.kind < right.kind;
  });
  const auto missing = static_cast<std::size_t>(-1);
  std::vector<std::size_t> expected(nodes.size(), missing);
  // The original all-pairs pass is the independent semantic oracle.
  for (std::size_t child = 0; child < nodes.size(); ++child) {
    std::size_t span = missing;
    for (std::size_t parent = 0; parent < nodes.size(); ++parent) {
      const auto& p = nodes[parent];
      const auto& c = nodes[child];
      if (p.start_offset <= c.start_offset && p.end_offset >= c.end_offset &&
          (p.start_offset < c.start_offset || p.end_offset > c.end_offset) &&
          p.end_offset - p.start_offset < span) {
        span = p.end_offset - p.start_offset;
        expected[child] = parent;
      }
    }
  }
  fsusblog::wasm::markdown::assign_syntax_parents(nodes);
  for (std::size_t index = 0; index < nodes.size(); ++index) {
    if (nodes[index].parent_index != expected[index]) {
      throw std::runtime_error("strict containment, smallest span, or earliest tie changed");
    }
  }
}

int main() {
  check({});
  check({{syntax_kind::paragraph, 0, 30}, {syntax_kind::link, 2, 20},
         {syntax_kind::image, 4, 6}});
  check({{syntax_kind::paragraph, 0, 10}, {syntax_kind::link, 0, 10},
         {syntax_kind::image, 1, 9}, {syntax_kind::latex, 1, 9},
         {syntax_kind::footnote, 5, 5}});
  check({{syntax_kind::paragraph, 0, 10}, {syntax_kind::link, 4, 14},
         {syntax_kind::image, 5, 6}, {syntax_kind::latex, 11, 12}});
  check({{syntax_kind::paragraph, 0, 4}, {syntax_kind::link, 4, 4},
         {syntax_kind::image, 4, 8}, {syntax_kind::latex, 8, 8}});
  std::mt19937 random(1080);
  for (int fixture = 0; fixture < 256; ++fixture) {
    std::vector<syntax_node> nodes;
    for (int index = 0; index < 64; ++index) {
      const std::size_t start = random() % 100;
      nodes.push_back({syntax_kind::paragraph, start, start + random() % 40});
    }
    check(nodes);
  }
  std::vector<syntax_node> siblings;
  for (std::size_t index = 0; index < 4096; ++index) {
    siblings.push_back({syntax_kind::heading, index * 10, index * 10 + 9});
  }
  check(siblings);
  std::cout << "262 native parent-assignment fixtures passed\n";
}
