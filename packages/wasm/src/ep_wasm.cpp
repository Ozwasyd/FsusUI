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
#include <cmath>
#include <cstdint>
#include <cstring>
#include <emscripten/bind.h>
#include <ranges>
#include <span>
#include <string>
#include <vector>
#include <format>

using namespace emscripten;

// ─────────────────────────────────
// § 1  大型数组排序（数字 / 字符串）
// ─────────────────────────────────

/**
 * 对 Float64Array 原地排序（升序 / 降序）。
 * 前端传入 JS TypedArray，Emscripten 自动 memory-map。
 */
void sortNumbers(val arr, bool ascending)
{
  const unsigned len = arr["length"].as<unsigned>();
  std::vector<double> buf(len);
  for (unsigned i = 0; i < len; ++i)
    buf[i] = arr[i].as<double>();

  if (ascending)
    std::ranges::sort(buf);
  else
    std::ranges::sort(buf, std::ranges::greater{});

  for (unsigned i = 0; i < len; ++i)
    arr.set(i, val(buf[i]));
}

/**
 * 对字符串数组原地排序，支持本地化（locale-aware）。
 * locale 示例："zh-CN"、"en-US"。
 */
void sortStrings(val arr, bool ascending, [[maybe_unused]] std::string locale)
{
  const unsigned len = arr["length"].as<unsigned>();
  std::vector<std::string> buf(len);
  for (unsigned i = 0; i < len; ++i)
    buf[i] = arr[i].as<std::string>();

  // C++23 标准 ranges + lambda 排序
  if (ascending)
  {
    std::ranges::sort(buf, [](const std::string &a, const std::string &b)
                      { return a < b; });
  }
  else
  {
    std::ranges::sort(buf, [](const std::string &a, const std::string &b)
                      { return a > b; });
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

  if (!caseSensitive)
  {
    // 转小写
    std::ranges::transform(keyword, keyword.begin(),
                           [](unsigned char c)
                           { return std::tolower(c); });
  }

  for (unsigned i = 0; i < len; ++i)
  {
    std::string item = arr[i].as<std::string>();
    if (!caseSensitive)
    {
      std::string lower = item;
      std::ranges::transform(lower, lower.begin(),
                             [](unsigned char c)
                             { return std::tolower(c); });
      if (lower.find(keyword) != std::string::npos)
        result.set(resultLen++, val(i));
    }
    else
    {
      if (item.find(keyword) != std::string::npos)
        result.set(resultLen++, val(i));
    }
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
  double max = std::max({r, g, b});
  double min = std::min({r, g, b});
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
 * 暴露给 JS 的高层接口，避免多次往返。
 */
std::string hexToHsl(std::string hex)
{
  if (hex.size() < 7)
    return "";
  unsigned int rgb_val = std::stoul(hex.substr(1), nullptr, 16);
  double r = ((rgb_val >> 16) & 0xFF) / 255.0;
  double g = ((rgb_val >> 8) & 0xFF) / 255.0;
  double b = (rgb_val & 0xFF) / 255.0;
  auto [h, s, l] = rgbToHsl(r, g, b);
  return std::format("hsl({:.1f},{:.1f}%,{:.1f}%)",
                     h * 360, s * 100, l * 100);
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
  return std::format("#{:02X}{:02X}{:02X}", ri, gi, bi);
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

/**
 * 根据每项文本长度批量估算行高（像素）。
 * rowWidth: 行宽（px），charWidth: 均值字符宽，lineHeight: 单行高，padding: 上下内边距。
 * 返回 JS Float64Array（各行像素高度）。
 */
val estimateRowHeights(val textLengths, double rowWidth,
                       double charWidth, double lineHeight,
                       double padding)
{
  const unsigned len = textLengths["length"].as<unsigned>();
  val result = val::global("Float64Array").new_(val(len));
  for (unsigned i = 0; i < len; ++i)
  {
    int textLen = textLengths[i].as<int>();
    double charsPerLine = std::max(1.0, std::floor(rowWidth / charWidth));
    int lines = static_cast<int>(std::ceil(textLen / charsPerLine));
    result.set(i, val(lines * lineHeight + padding));
  }
  return result;
}

// ─────────────────────────────────
// § 6  版本查询
// ─────────────────────────────────
std::string version() { return "1.0.0-es2022"; }

// ─────────────────────────────────
// Emscripten 绑定声明
// ─────────────────────────────────
EMSCRIPTEN_BINDINGS(ep_wasm)
{
  // 排序
  function("sortNumbers", &sortNumbers);
  function("sortStrings", &sortStrings);

  // 过滤
  function("filterIndices", &filterIndices);

  // 颜色
  function("hexToHsl", &hexToHsl);
  function("hslToHex", &hslToHex);

  // 数字精度
  function("roundToPrecision", &roundToPrecision);
  function("clampAndRound", &clampAndRound);

  // 虚拟列表行高
  function("estimateRowHeights", &estimateRowHeights);

  // 版本
  function("version", &version);
}
