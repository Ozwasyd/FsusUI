/**
 * FsusUI WASM Module — C++23 / Emscripten
 *
 * 覆盖重计算场景：
 *   1. 大型数组排序（表格列排序）
 *   2. 关键词过滤（虚拟列表 / 表格行过滤）
 *   3. HSL/HEX/RGB 颜色空间互转（ColorPicker）
 *   4. 任意精度小数舍入（InputNumber）
 *   5. 行高估算（VirtualList）
 * 通过 Emscripten 导出为 WASM + JS glue，TypeScript 层封装后
 * 以 Tree-Shaking 友好的方式向组件暴露。
 */

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstddef>
#include <cctype>
#include <cstdint>
#include <emscripten/bind.h>
#include <emscripten/emscripten.h>
#include <functional>
#include <iomanip>
#include <sstream>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

using namespace emscripten;

namespace
{
constexpr auto asciiToLower = [](unsigned char c) {
  return static_cast<char>(std::tolower(c));
};

unsigned char toAsciiLower(unsigned char c)
{
  if (c >= 'A' && c <= 'Z')
  {
    return static_cast<unsigned char>(c + ('a' - 'A'));
  }

  return c;
}

bool containsAsciiKeyword(const unsigned char* label,
                          std::int32_t labelLength,
                          const unsigned char* keyword,
                          std::int32_t keywordLength,
                          bool caseSensitive)
{
  if (keywordLength <= 0)
    return true;
  if (labelLength < keywordLength)
    return false;

  for (std::int32_t index = 0; index <= labelLength - keywordLength; ++index)
  {
    bool matched = true;
    for (std::int32_t keywordIndex = 0; keywordIndex < keywordLength;
         ++keywordIndex)
    {
      unsigned char left = label[index + keywordIndex];
      unsigned char right = keyword[keywordIndex];

      if (!caseSensitive)
      {
        left = toAsciiLower(left);
        right = toAsciiLower(right);
      }

      if (left != right)
      {
        matched = false;
        break;
      }
    }

    if (matched)
      return true;
  }

  return false;
}

void sortNumbersBuffer(std::span<double> data, bool ascending)
{
  if (ascending)
  {
    std::sort(data.begin(), data.end());
    return;
  }

  std::sort(data.begin(), data.end(), std::greater<>{});
}

void estimateRowHeightsBuffer(std::span<const std::int32_t> textLengths,
                              double rowWidth,
                              double charWidth,
                              double lineHeight,
                              double padding,
                              std::span<double> output)
{
  const double charsPerLine = std::max(1.0, std::floor(rowWidth / charWidth));

  for (std::size_t i = 0; i < textLengths.size(); ++i)
  {
    const int lines = static_cast<int>(
      std::ceil(static_cast<double>(textLengths[i]) / charsPerLine));
    output[i] = lines * lineHeight + padding;
  }
}

bool parseHexRgb(std::string_view hex, std::uint32_t& rgbValue)
{
  if (hex.size() != 7 || hex.front() != '#')
    return false;

  const auto digits = hex.substr(1);
  const auto [ptr, ec] = std::from_chars(
    digits.data(), digits.data() + digits.size(), rgbValue, 16);

  if (ec != std::errc{} || ptr != digits.data() + digits.size())
    throw std::invalid_argument("invalid hex color");

  return true;
}
} // namespace

extern "C"
{
EMSCRIPTEN_KEEPALIVE void sort_numbers_buffer(double* data,
                                              std::size_t len,
                                              int ascending)
{
  sortNumbersBuffer({data, len}, ascending != 0);
}

EMSCRIPTEN_KEEPALIVE void estimate_row_heights_buffer(
  const std::int32_t* lengths,
  std::size_t len,
  double rowWidth,
  double charWidth,
  double lineHeight,
  double padding,
  double* out)
{
  estimateRowHeightsBuffer(
    {lengths, len}, rowWidth, charWidth, lineHeight, padding, {out, len});
}

EMSCRIPTEN_KEEPALIVE std::int32_t filter_ascii_indices_buffer(
  const unsigned char* labels,
  const std::int32_t* offsets,
  const std::int32_t* lengths,
  std::int32_t count,
  const unsigned char* keyword,
  std::int32_t keywordLength,
  int caseSensitive,
  std::int32_t* out)
{
  std::int32_t matchedCount = 0;

  for (std::int32_t index = 0; index < count; ++index)
  {
    const auto offset = offsets[index];
    const auto length = lengths[index];
    if (containsAsciiKeyword(labels + offset,
                             length,
                             keyword,
                             keywordLength,
                             caseSensitive != 0))
    {
      out[matchedCount++] = index;
    }
  }

  return matchedCount;
}
}

// ─────────────────────────────────
// § 1  大型数组排序（数字 / 字符串）
// ─────────────────────────────────

/**
 * 对字符串数组原地排序。
 * 注意：当前实现仍然是字节序排序，locale 语义保留在 TS 包装层兼容处理。
 */
void sortStrings(val arr, bool ascending)
{
  const unsigned len = arr["length"].as<unsigned>();
  std::vector<std::string> buf(len);
  for (unsigned i = 0; i < len; ++i)
    buf[i] = arr[i].as<std::string>();

  if (ascending)
  {
    std::sort(buf.begin(), buf.end(), std::less<>{});
  }
  else
  {
    std::sort(buf.begin(), buf.end(), std::greater<>{});
  }

  for (unsigned i = 0; i < len; ++i)
    arr.set(i, val(buf[i]));
}

// ─────────────────────────────────
// § 2  关键词过滤，返回命中下标数组
// ─────────────────────────────────

/**
 * 在字符串数组中搜索 keyword，区分大小写可选。
 * 返回命中行的 0-based 索引列表（JS Array<number>）。
 */
val filterIndices(val arr, std::string keyword, bool caseSensitive)
{
  const unsigned len = arr["length"].as<unsigned>();
  val result = val::array();
  unsigned resultLen = 0;

  if (caseSensitive)
  {
    for (unsigned i = 0; i < len; ++i)
    {
      std::string item = arr[i].as<std::string>();
      if (item.find(keyword) != std::string::npos)
        result.set(resultLen++, val(i));
    }

    return result;
  }

  std::transform(keyword.begin(), keyword.end(), keyword.begin(), asciiToLower);

  for (unsigned i = 0; i < len; ++i)
  {
    std::string item = arr[i].as<std::string>();
    std::transform(item.begin(), item.end(), item.begin(), asciiToLower);
    if (item.find(keyword) != std::string::npos)
      result.set(resultLen++, val(i));
  }

  return result;
}

// ─────────────────────────────────
// § 3  颜色空间互转（ColorPicker）
// ─────────────────────────────────

struct RGB
{
  double r, g, b;
};
struct HSL
{
  double h, s, l;
};

static double hue2rgb(double p, double q, double t)
{
  if (t < 0)
    t += 1;
  if (t > 1)
    t -= 1;
  if (t < 1.0 / 6)
    return p + (q - p) * 6 * t;
  if (t < 1.0 / 2)
    return q;
  if (t < 2.0 / 3)
    return p + (q - p) * (2.0 / 3 - t) * 6;
  return p;
}

/** HSL → RGB（分量均在 [0,1] 范围） */
RGB hslToRgb(double h, double s, double l)
{
  if (s == 0)
    return {l, l, l};
  double q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  double p = 2 * l - q;
  return {hue2rgb(p, q, h + 1.0 / 3),
          hue2rgb(p, q, h),
          hue2rgb(p, q, h - 1.0 / 3)};
}

/** RGB → HSL */
HSL rgbToHsl(double r, double g, double b)
{
  const auto [min, max] = std::minmax({r, g, b});
  double h = 0, s = 0, l = (max + min) / 2;
  if (max != min)
  {
    double d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max == r)
      h = (g - b) / d + (g < b ? 6 : 0);
    else if (max == g)
      h = (b - r) / d + 2;
    else
      h = (r - g) / d + 4;
    h /= 6;
  }
  return {h, s, l};
}

/**
 * HEX string (#RRGGBB) → CSS "hsl(H, S%, L%)" string
 */
std::string hexToHsl(std::string hex)
{
  std::uint32_t rgbValue = 0;
  if (!parseHexRgb(hex, rgbValue))
    return "";

  double r = ((rgbValue >> 16) & 0xFF) / 255.0;
  double g = ((rgbValue >> 8) & 0xFF) / 255.0;
  double b = (rgbValue & 0xFF) / 255.0;
  auto [h, s, l] = rgbToHsl(r, g, b);
  std::ostringstream out;
  out << std::fixed << std::setprecision(1)
      << "hsl(" << h * 360 << ',' << s * 100 << "%," << l * 100 << "%)";
  return out.str();
}

/**
 * CSS "hsl(H, S%, L%)" → HEX string (#RRGGBB)
 */
std::string hslToHex(double h, double s, double l)
{
  auto [r, g, b] = hslToRgb(h / 360.0, s / 100.0, l / 100.0);
  unsigned int ri = static_cast<unsigned int>(std::round(r * 255));
  unsigned int gi = static_cast<unsigned int>(std::round(g * 255));
  unsigned int bi = static_cast<unsigned int>(std::round(b * 255));
  std::ostringstream out;
  out << '#' << std::uppercase << std::hex << std::setfill('0')
      << std::setw(2) << ri
      << std::setw(2) << gi
      << std::setw(2) << bi;
  return out.str();
}

// ─────────────────────────────────
// § 4  任意精度小数舍入（InputNumber）
// ─────────────────────────────────

/**
 * 以给定精度舍入 value（四舍五入到 precision 位小数）。
 * 避免 JS 的 IEEE-754 浮点精度陷阱（如 0.1 + 0.2）。
 */
double roundToPrecision(double value, int precision)
{
  double factor = std::pow(10.0, precision);
  return std::round(value * factor) / factor;
}

/**
 * 对 value 施加 [min, max] 钳位并舍入。
 */
double clampAndRound(double value, double min, double max, int precision)
{
  double clamped = std::clamp(value, min, max);
  return roundToPrecision(clamped, precision);
}

// ─────────────────────────────────
// § 5  VirtualList 行高批量估算
// ─────────────────────────────────

// ─────────────────────────────────
// § 6  版本查询
// ─────────────────────────────────
std::string version() { return "1.0.0-es2022"; }

// ─────────────────────────────────
// Emscripten 绑定声明
// ─────────────────────────────────
EMSCRIPTEN_BINDINGS(ep_wasm)
{
  function("sortStrings", &sortStrings);
  function("filterIndices", &filterIndices);
  function("hexToHsl", &hexToHsl);
  function("hslToHex", &hslToHex);
  function("roundToPrecision", &roundToPrecision);
  function("clampAndRound", &clampAndRound);
  function("version", &version);
}
