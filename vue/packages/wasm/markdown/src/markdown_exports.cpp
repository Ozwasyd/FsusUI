#include "markdown_contract.hpp"

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <emscripten/emscripten.h>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace {

enum class ErrorCode : std::uint8_t {
  None = 0,
  InvalidInput = 1
};

enum class PayloadMode : std::uint8_t {
  Full = 0,
  Summary = 1,
  HtmlOnly = 2,
  Chunks = 3
};

thread_local std::string g_last_html;
thread_local std::string g_last_error;
thread_local ErrorCode g_last_error_code = ErrorCode::None;
thread_local std::string g_last_metadata_payload;
thread_local std::string g_last_features_payload;
thread_local std::string g_last_placeholders_payload;
thread_local std::string g_last_chunks_payload;
thread_local std::string g_last_renderer_version;

const char* to_error_string(ErrorCode code) {
  switch (code) {
    case ErrorCode::None:
      return "";
    case ErrorCode::InvalidInput:
      return "source_invalid";
    default:
      return "markdown_render_failed";
  }
}

void append_payload_string(std::string& out, std::string_view value) {
  out.push_back('"');
  for (char ch : value) {
    switch (ch) {
      case '\\':
        out.append("\\\\");
        break;
      case '"':
        out.append("\\\"");
        break;
      case '\n':
        out.append("\\n");
        break;
      case '\r':
        out.append("\\r");
        break;
      case '\t':
        out.append("\\t");
        break;
      default:
        out.push_back(ch);
        break;
    }
  }
  out.push_back('"');
}

std::string feature_name(fsusblog::wasm::markdown::feature value) {
  using fsusblog::wasm::markdown::feature;
  switch (value) {
    case feature::code_block: return "code_block";
    case feature::latex: return "latex";
    case feature::mermaid: return "mermaid";
    case feature::table: return "table";
    case feature::image: return "image";
    case feature::heading: return "heading";
    case feature::link: return "link";
    case feature::emphasis: return "emphasis";
    case feature::footnote: return "footnote";
  }

  return "unknown";
}

std::string placeholder_kind_name(fsusblog::wasm::markdown::placeholder_kind value) {
  using fsusblog::wasm::markdown::placeholder_kind;
  switch (value) {
    case placeholder_kind::latex_inline: return "latex_inline";
    case placeholder_kind::latex_block: return "latex_block";
    case placeholder_kind::mermaid_block: return "mermaid_block";
  }

  return "unknown";
}

std::string render_mode_name(fsusblog::wasm::markdown::render_mode value) {
  using fsusblog::wasm::markdown::render_mode;
  switch (value) {
    case render_mode::article: return "article";
    case render_mode::about: return "about";
    case render_mode::preview: return "preview";
    case render_mode::editor: return "editor";
  }

  return "article";
}

std::string build_features_payload(const fsusblog::wasm::markdown::render_result& result) {
  std::string payload;
  payload.push_back('[');
  bool first = true;
  for (const auto feature : result.features) {
    if (!first) {
      payload.push_back(',');
    }
    first = false;
    append_payload_string(payload, feature_name(feature));
  }
  payload.push_back(']');
  return payload;
}

std::string build_placeholders_payload(const fsusblog::wasm::markdown::render_result& result) {
  std::string payload;
  payload.push_back('[');
  bool first = true;
  for (const auto& placeholder : result.placeholders) {
    if (!first) {
      payload.push_back(',');
    }
    first = false;
    payload.append("{\"kind\":");
    append_payload_string(payload, placeholder_kind_name(placeholder.kind));
    payload.append(",\"token\":");
    append_payload_string(payload, placeholder.token);
    payload.append(",\"label\":");
    append_payload_string(payload, placeholder.label);
    payload.append(",\"source\":");
    append_payload_string(payload, placeholder.source);
    payload.append(",\"line\":");
    payload.append(std::to_string(placeholder.line));
    payload.append(",\"column\":");
    payload.append(std::to_string(placeholder.column));
    payload.append(",\"endLine\":");
    payload.append(std::to_string(placeholder.end_line));
    payload.append(",\"endColumn\":");
    payload.append(std::to_string(placeholder.end_column));
    payload.append(",\"startOffset\":");
    payload.append(std::to_string(placeholder.start_offset));
    payload.append(",\"endOffset\":");
    payload.append(std::to_string(placeholder.end_offset));
    payload.push_back('}');
  }
  payload.push_back(']');
  return payload;
}

std::string build_metadata_payload(const fsusblog::wasm::markdown::render_result& result) {
  std::string payload;
  payload.push_back('{');
  payload.append("\"mode\":");
  append_payload_string(payload, render_mode_name(result.metadata.mode));
  payload.append(",\"baseUrl\":");
  append_payload_string(payload, result.metadata.base_url);
  payload.append(",\"allowHtml\":");
  payload.append(result.metadata.allow_html ? "true" : "false");
  payload.append(",\"allowLatex\":");
  payload.append(result.metadata.allow_latex ? "true" : "false");
  payload.append(",\"allowMermaid\":");
  payload.append(result.metadata.allow_mermaid ? "true" : "false");
  payload.append(",\"sourceLength\":");
  payload.append(std::to_string(result.metadata.source_length));
  payload.append(",\"sourceLineCount\":");
  payload.append(std::to_string(result.metadata.source_line_count));
  payload.append(",\"normalizedSourceLength\":");
  payload.append(std::to_string(result.metadata.normalized_source_length));
  payload.append(",\"featureCount\":");
  payload.append(std::to_string(result.metadata.feature_count));
  payload.append(",\"placeholderCount\":");
  payload.append(std::to_string(result.metadata.placeholder_count));
  payload.append(",\"rendererVersion\":");
  append_payload_string(payload, result.metadata.renderer_version);
  payload.push_back('}');
  return payload;
}

bool is_name_char(char ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-';
}

std::size_t find_tag_end(std::string_view html, std::size_t tag_start) {
  char quote = '\0';
  for (std::size_t index = tag_start + 1; index < html.size(); ++index) {
    const char ch = html[index];
    if (quote != '\0') {
      if (ch == quote) {
        quote = '\0';
      }
      continue;
    }
    if (ch == '"' || ch == '\'') {
      quote = ch;
      continue;
    }
    if (ch == '>') {
      return index;
    }
  }
  return html.size() == 0 ? 0 : html.size() - 1;
}

std::string read_tag_name(std::string_view html, std::size_t tag_start, bool closing) {
  std::size_t index = tag_start + (closing ? 2 : 1);
  while (index < html.size() && html[index] == ' ') {
    ++index;
  }

  const std::size_t start = index;
  while (index < html.size() && is_name_char(html[index])) {
    ++index;
  }

  return std::string(html.substr(start, index - start));
}

bool is_void_tag(std::string_view tag) {
  return tag == "br" || tag == "hr" || tag == "img" || tag == "input" || tag == "meta" || tag == "link";
}

bool is_self_closing_tag(std::string_view html, std::size_t tag_start, std::size_t tag_end, std::string_view tag) {
  if (is_void_tag(tag)) {
    return true;
  }
  if (tag_end == 0 || tag_end <= tag_start) {
    return false;
  }
  std::size_t index = tag_end;
  while (index > tag_start && html[index - 1] == ' ') {
    --index;
  }
  return index > tag_start && html[index - 1] == '/';
}

std::size_t find_chunk_end(std::string_view html, std::size_t start) {
  if (start >= html.size()) {
    return html.size();
  }

  if (html[start] != '<') {
    const std::size_t next = html.find('<', start + 1);
    return next == std::string_view::npos ? html.size() : next;
  }

  std::vector<std::string> stack;
  std::size_t cursor = start;
  while (cursor < html.size()) {
    const std::size_t tag_start = html.find('<', cursor);
    if (tag_start == std::string_view::npos) {
      return html.size();
    }

    if (tag_start + 4 <= html.size() && html.substr(tag_start, 4) == "<!--") {
      const std::size_t comment_end = html.find("-->", tag_start + 4);
      cursor = comment_end == std::string_view::npos ? html.size() : comment_end + 3;
      continue;
    }

    if (tag_start + 1 >= html.size()) {
      return html.size();
    }

    const bool closing = html[tag_start + 1] == '/';
    const char marker = html[tag_start + 1];
    if (marker == '!' || marker == '?') {
      const std::size_t tag_end = find_tag_end(html, tag_start);
      cursor = tag_end + 1;
      continue;
    }

    const std::size_t tag_end = find_tag_end(html, tag_start);
    const std::string tag = read_tag_name(html, tag_start, closing);

    if (tag.empty()) {
      cursor = tag_end + 1;
      continue;
    }

    if (closing) {
      if (!stack.empty()) {
        stack.pop_back();
      }
      if (stack.empty()) {
        return tag_end + 1;
      }
    } else if (!is_self_closing_tag(html, tag_start, tag_end, tag)) {
      stack.push_back(tag);
    } else if (tag_start == start && stack.empty()) {
      return tag_end + 1;
    }

    cursor = tag_end + 1;
  }

  return html.size();
}

std::string chunk_kind(std::string_view chunk) {
  auto starts_tag = [&](std::string_view tag) {
    if (chunk.size() < tag.size() + 2 || chunk[0] != '<') {
      return false;
    }
    if (chunk.substr(1, tag.size()) != tag) {
      return false;
    }
    const char next = chunk[1 + tag.size()];
    return next == '>' || next == ' ' || next == '/';
  };

  if (
    starts_tag("h1") ||
    starts_tag("h2") ||
    starts_tag("h3") ||
    starts_tag("h4") ||
    starts_tag("h5") ||
    starts_tag("h6")
  ) return "heading";
  if (starts_tag("pre")) return "code";
  if (starts_tag("p")) return "paragraph";
  if (starts_tag("ul") || starts_tag("ol")) return "list";
  if (starts_tag("table")) return "table";
  if (starts_tag("blockquote")) return "blockquote";
  if (starts_tag("section") && chunk.find("class=\"footnotes\"") != std::string_view::npos) return "footnotes";
  if (starts_tag("hr")) return "rule";
  if (chunk.find("markdown-renderer__mermaid") != std::string_view::npos) return "mermaid";
  if (chunk.find("markdown-renderer__latex") != std::string_view::npos) return "latex";
  return "html";
}

std::size_t read_dimension_attr(std::string_view chunk, std::string_view attr) {
  const std::size_t attr_pos = chunk.find(attr);
  if (attr_pos == std::string_view::npos) {
    return 0;
  }

  std::size_t value_start = attr_pos + attr.size();
  if (value_start >= chunk.size() || chunk[value_start] != '"') {
    return 0;
  }
  ++value_start;

  std::size_t value_end = value_start;
  while (value_end < chunk.size() && chunk[value_end] >= '0' && chunk[value_end] <= '9') {
    ++value_end;
  }

  if (value_end == value_start) {
    return 0;
  }

  return static_cast<std::size_t>(std::strtoull(std::string(chunk.substr(value_start, value_end - value_start)).c_str(), nullptr, 10));
}

std::size_t estimate_chunk_size(std::string_view chunk, std::string_view kind) {
  if (kind == "heading") return 52;
  if (kind == "rule") return 24;
  if (kind == "table") return 160;
  if (kind == "code") return 180;
  if (kind == "blockquote") return 96;
  if (kind == "mermaid") {
    const std::size_t height = read_dimension_attr(chunk, "data-mermaid-height=");
    return height > 0 ? height + 24 : 180;
  }
  if (kind == "latex") {
    const std::size_t height = read_dimension_attr(chunk, "data-latex-height=");
    return height > 0 ? height + 16 : 72;
  }
  if (kind == "list") {
    return 48 + (chunk.size() / 120) * 22;
  }
  if (kind == "paragraph") {
    return 38 + (chunk.size() / 110) * 22;
  }
  return 48 + (chunk.size() / 140) * 20;
}

std::string build_chunks_payload(std::string_view html) {
  std::string payload;
  payload.push_back('[');

  std::size_t index = 0;
  std::size_t chunk_index = 0;
  bool first = true;

  while (index < html.size()) {
    while (index < html.size() && (html[index] == '\n' || html[index] == '\r' || html[index] == '\t' || html[index] == ' ')) {
      ++index;
    }
    if (index >= html.size()) {
      break;
    }

    const std::size_t end = find_chunk_end(html, index);
    if (end <= index) {
      break;
    }

    const std::string_view chunk = html.substr(index, end - index);
    const std::string kind = chunk_kind(chunk);

    if (!first) {
      payload.push_back(',');
    }
    first = false;

    payload.append("{\"key\":");
    append_payload_string(payload, "md-" + std::to_string(chunk_index) + "-" + std::to_string(index));
    payload.append(",\"kind\":");
    append_payload_string(payload, kind);
    payload.append(",\"html\":");
    append_payload_string(payload, chunk);
    payload.append(",\"estimatedSize\":");
    payload.append(std::to_string(estimate_chunk_size(chunk, kind)));
    payload.append(",\"htmlStartOffset\":");
    payload.append(std::to_string(index));
    payload.append(",\"htmlEndOffset\":");
    payload.append(std::to_string(end));
    payload.push_back('}');

    index = end;
    ++chunk_index;
  }

  payload.push_back(']');
  return payload;
}

void set_success(const fsusblog::wasm::markdown::render_result& result, PayloadMode mode) {
  g_last_html = result.html;
  g_last_metadata_payload = mode == PayloadMode::HtmlOnly ? "" : build_metadata_payload(result);
  g_last_features_payload = mode == PayloadMode::HtmlOnly ? "" : build_features_payload(result);
  g_last_placeholders_payload = mode == PayloadMode::Full ? build_placeholders_payload(result) : "";
  g_last_chunks_payload = mode == PayloadMode::Chunks ? build_chunks_payload(result.html) : "";
  g_last_renderer_version = std::string(fsusblog::wasm::markdown::renderer_version);
  g_last_error.clear();
  g_last_error_code = ErrorCode::None;
}

void set_success_html(std::string html) {
  g_last_html = std::move(html);
  g_last_metadata_payload.clear();
  g_last_features_payload.clear();
  g_last_placeholders_payload.clear();
  g_last_chunks_payload.clear();
  g_last_renderer_version = std::string(fsusblog::wasm::markdown::renderer_version);
  g_last_error.clear();
  g_last_error_code = ErrorCode::None;
}

void set_error(ErrorCode code, std::string_view error) {
  g_last_html.clear();
  g_last_metadata_payload.clear();
  g_last_features_payload.clear();
  g_last_placeholders_payload.clear();
  g_last_chunks_payload.clear();
  g_last_renderer_version.clear();
  g_last_error_code = code;
  g_last_error.assign(error.data(), error.size());
}

template <typename T>
const char* ptr_or_empty(const T& value) {
  return value.empty() ? "" : value.c_str();
}

} // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
void* markdown_alloc_buffer(std::size_t size) {
  return std::malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void* alloc_buffer(std::size_t size) {
  return markdown_alloc_buffer(size);
}

EMSCRIPTEN_KEEPALIVE
void markdown_free_buffer(void* ptr) {
  std::free(ptr);
}

EMSCRIPTEN_KEEPALIVE
void free_buffer(void* ptr) {
  markdown_free_buffer(ptr);
}

int render_with_payload_mode(const char* source_ptr, int source_len, int allow_html, int allow_latex, int allow_mermaid, PayloadMode mode) {
  if (source_ptr == nullptr || source_len < 0) {
    set_error(ErrorCode::InvalidInput, to_error_string(ErrorCode::InvalidInput));
    return 0;
  }

  fsusblog::wasm::markdown::render_request request;
  request.source.assign(source_ptr, source_ptr + source_len);
  request.allow_html = allow_html != 0;
  request.allow_latex = allow_latex != 0;
  request.allow_mermaid = allow_mermaid != 0;

  if (mode == PayloadMode::HtmlOnly) {
    set_success_html(fsusblog::wasm::markdown::render_html(request));
    return 1;
  }

  const auto result = mode == PayloadMode::Summary
    ? fsusblog::wasm::markdown::build_summary_result(request)
    : fsusblog::wasm::markdown::build_render_result(request);
  set_success(result, mode);
  return 1;
}

EMSCRIPTEN_KEEPALIVE
int markdown_render(const char* source_ptr, int source_len, int allow_html, int allow_latex, int allow_mermaid) {
  return render_with_payload_mode(source_ptr, source_len, allow_html, allow_latex, allow_mermaid, PayloadMode::Full);
}

EMSCRIPTEN_KEEPALIVE
int markdown_render_profile(const char* source_ptr, int source_len, int allow_html, int allow_latex, int allow_mermaid, int payload_mode) {
  const auto mode = payload_mode == 3
    ? PayloadMode::Chunks
    : payload_mode == 2
    ? PayloadMode::HtmlOnly
    : payload_mode == 1
      ? PayloadMode::Summary
      : PayloadMode::Full;
  return render_with_payload_mode(source_ptr, source_len, allow_html, allow_latex, allow_mermaid, mode);
}

EMSCRIPTEN_KEEPALIVE
int render_markdown(const char* source_ptr, int source_len, int allow_html, int allow_latex, int allow_mermaid) {
  return markdown_render(source_ptr, source_len, allow_html, allow_latex, allow_mermaid);
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_html_ptr() {
  return ptr_or_empty(g_last_html);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_html_ptr() {
  return markdown_get_last_html_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_html_len() {
  return static_cast<int>(g_last_html.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_html_len() {
  return markdown_get_last_html_len();
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_metadata_ptr() {
  return ptr_or_empty(g_last_metadata_payload);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_metadata_ptr() {
  return markdown_get_last_metadata_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_metadata_len() {
  return static_cast<int>(g_last_metadata_payload.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_metadata_len() {
  return markdown_get_last_metadata_len();
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_error_ptr() {
  return ptr_or_empty(g_last_error);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_error_ptr() {
  return markdown_get_last_error_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_error_len() {
  return static_cast<int>(g_last_error.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_error_len() {
  return markdown_get_last_error_len();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_error_code() {
  return static_cast<int>(g_last_error_code);
}

EMSCRIPTEN_KEEPALIVE
int get_last_error_code() {
  return markdown_get_last_error_code();
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_features_ptr() {
  return ptr_or_empty(g_last_features_payload);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_features_ptr() {
  return markdown_get_last_features_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_features_len() {
  return static_cast<int>(g_last_features_payload.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_features_len() {
  return markdown_get_last_features_len();
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_placeholders_ptr() {
  return ptr_or_empty(g_last_placeholders_payload);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_placeholders_ptr() {
  return markdown_get_last_placeholders_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_placeholders_len() {
  return static_cast<int>(g_last_placeholders_payload.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_placeholders_len() {
  return markdown_get_last_placeholders_len();
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_chunks_ptr() {
  return ptr_or_empty(g_last_chunks_payload);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_chunks_ptr() {
  return markdown_get_last_chunks_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_chunks_len() {
  return static_cast<int>(g_last_chunks_payload.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_chunks_len() {
  return markdown_get_last_chunks_len();
}

EMSCRIPTEN_KEEPALIVE
const char* markdown_get_last_renderer_version_ptr() {
  return ptr_or_empty(g_last_renderer_version);
}

EMSCRIPTEN_KEEPALIVE
const char* get_last_renderer_version_ptr() {
  return markdown_get_last_renderer_version_ptr();
}

EMSCRIPTEN_KEEPALIVE
int markdown_get_last_renderer_version_len() {
  return static_cast<int>(g_last_renderer_version.size());
}

EMSCRIPTEN_KEEPALIVE
int get_last_renderer_version_len() {
  return markdown_get_last_renderer_version_len();
}

} // extern "C"
const char* to_error_string(ErrorCode code) {
  switch (code) {
    case ErrorCode::None:
      return "";
    case ErrorCode::InvalidInput:
      return "source_invalid";
    default:
      return "markdown_render_failed";
  }
}
