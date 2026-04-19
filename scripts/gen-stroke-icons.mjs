/**
 * gen-stroke-icons.mjs
 * 
 * 将所有 Element Plus 图标替换为 Lucide stroke 风格图标。
 * 对于 Lucide 没有对应的图标（食物、品牌等），生成自定义 stroke SVG。
 * 
 * 运行: node scripts/gen-stroke-icons.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const COMPONENTS_DIR = path.join(ROOT, 'packages/icons-vue/src/components')

// 引入 lucide 图标数据（CommonJS）
const lucideIcons = require(path.join(ROOT, 'node_modules/lucide/dist/cjs/lucide.js'))

// ============================================================================
// EP 图标名 → Lucide 图标名 映射表
// null = 使用自定义 SVG
// ============================================================================
const EP_TO_LUCIDE = {
  // Arrows
  AddLocation:        'MapPin',
  Aim:                'Crosshair',
  AlarmClock:         'AlarmClock',
  ArrowDownBold:      'ChevronDown',
  ArrowDown:          'ArrowDown',
  ArrowLeftBold:      'ChevronLeft',
  ArrowLeft:          'ArrowLeft',
  ArrowRightBold:     'ChevronRight',
  ArrowRight:         'ArrowRight',
  ArrowUpBold:        'ChevronUp',
  ArrowUp:            'ArrowUp',
  Back:               'Undo2',
  BottomLeft:         'ArrowDownLeft',
  BottomRight:        'ArrowDownRight',
  Bottom:             'ArrowDown',
  CaretBottom:        'ChevronDown',
  CaretLeft:          'ChevronLeft',
  CaretRight:         'ChevronRight',
  CaretTop:           'ChevronUp',
  DArrowLeft:         'ChevronsLeft',
  DArrowRight:        'ChevronsRight',
  DCaret:             'ChevronsUpDown',
  TopLeft:            'ArrowUpLeft',
  TopRight:           'ArrowUpRight',
  Top:                'ArrowUp',
  Right:              'ArrowRight',
  RefreshLeft:        'RotateCcw',
  RefreshRight:       'RotateCw',
  Refresh:            'RefreshCw',
  ZoomIn:             'ZoomIn',
  ZoomOut:            'ZoomOut',

  // Status / Feedback
  Check:              'Check',
  Checked:            'CheckSquare',
  CircleCheckFilled:  'CheckCircle',
  CircleCheck:        'CheckCircle',
  CircleCloseFilled:  'XCircle',
  CircleClose:        'XCircle',
  CirclePlusFilled:   'PlusCircle',
  CirclePlus:         'PlusCircle',
  CloseBold:          'X',
  Close:              'X',
  Failed:             'XCircle',
  Finished:           'CheckCircle2',
  HelpFilled:         'HelpCircle',
  Help:               'HelpCircle',
  InfoFilled:         null,
  Loading:            'Loader',
  QuestionFilled:     'HelpCircle',
  RemoveFilled:       'MinusCircle',
  Remove:             'Minus',
  SuccessFilled:      'CheckCircle2',
  WarnTriangleFilled: 'AlertTriangle',
  WarningFilled:      'AlertCircle',
  Warning:            'AlertTriangle',
  SemiSelect:         'Minus',

  // Documents / Files
  CopyDocument:       'Copy',
  Delete:             'Trash2',
  DeleteFilled:       'Trash2',
  Document:           'FileText',
  DocumentAdd:        'FilePlus',
  DocumentChecked:    'FileCheck',
  DocumentCopy:       'Copy',
  DocumentDelete:     'FileX',
  DocumentRemove:     'FileMinus',
  Download:           'Download',
  Edit:               'Pencil',
  EditPen:            'PenLine',
  Files:              'Files',
  Filter:             'Filter',
  Fold:               'FoldVertical',
  FolderAdd:          'FolderPlus',
  FolderChecked:      'FolderCheck',
  FolderDelete:       'FolderX',
  FolderOpened:       'FolderOpen',
  FolderRemove:       'FolderMinus',
  Folder:             'Folder',
  Memo:               'ClipboardList',
  Notebook:           'BookOpen',
  Paperclip:          'Paperclip',
  Postcard:           'CreditCard',
  Printer:            'Printer',
  ScaleToOriginal:    'Maximize2',
  Scissor:            'Scissors',
  Stamp:              'Stamp',
  Tickets:            'Ticket',
  Ticket:             'Ticket',
  Upload:             'Upload',
  UploadFilled:       'Upload',

  // Media / Camera
  Camera:             'Camera',
  CameraFilled:       'Camera',
  Film:               'Film',
  FullScreen:         'Maximize',
  Hide:               'EyeOff',
  Mic:                'Mic',
  Microphone:         'Mic2',
  Mute:               'MicOff',
  MuteNotification:   'BellOff',
  VideoCameraFilled:  'Video',
  VideoCamera:        'Video',
  VideoPause:         'PauseCircle',
  VideoPlay:          'PlayCircle',
  View:               'Eye',
  Picture:            'Image',
  PictureFilled:      'Image',
  PictureRounded:     'Images',

  // Communication
  Bell:               'Bell',
  BellFilled:         'BellRing',
  ChatDotRound:       'MessageCircleMore',
  ChatDotSquare:      'MessageSquareMore',
  ChatLineRound:      'MessageCircle',
  ChatLineSquare:     'MessageSquare',
  ChatRound:          'MessageCircle',
  ChatSquare:         'MessageSquare',
  Comment:            'MessageSquare',
  Message:            'Mail',
  MessageBox:         'Inbox',
  Notification:       'Bell',

  // UI Controls
  Expand:             'Expand',
  Grid:               'LayoutGrid',
  Histogram:          'BarChart2',
  List:               'List',
  Menu:               'Menu',
  Minus:              'Minus',
  More:               'MoreHorizontal',
  MoreFilled:         'MoreVertical',
  Open:               'ExternalLink',
  Operation:          'SlidersHorizontal',
  PieChart:           'PieChart',
  Plus:               'Plus',
  Pointer:            'MousePointer',
  Rank:               'ArrowUpDown',
  Search:             'Search',
  Select:             'CheckSquare',
  Setting:            'Settings',
  SetUp:              'Settings2',
  Share:              'Share2',
  SortDown:           'SortDesc',
  SortUp:             'SortAsc',
  Sort:               'ArrowUpDown',
  SwitchButton:       'Power',
  SwitchFilled:       'ToggleRight',
  Switch:             'RefreshCcw',
  TrendCharts:        'TrendingUp',
  Platform:           'Monitor',

  // People / User
  Avatar:             'User',
  Female:             'Venus',
  Male:               'Mars',
  User:               'User',
  UserFilled:         'UserCircle',
  Service:            'Headphones',

  // Location / Map
  Compass:            'Compass',
  Coordinate:         'Crosshair',
  DeleteLocation:     'MapPinOff',
  Guide:              'Navigation',
  Location:           'MapPin',
  LocationFilled:     'MapPin',
  LocationInformation:'MapPin',
  MapLocation:        'Map',
  Place:              'MapPin',
  Position:           'Locate',

  // Commerce / Business
  Briefcase:          'Briefcase',
  Coin:               'Coins',
  CreditCard:         'CreditCard',
  DataAnalysis:       'LineChart',
  DataBoard:          'LayoutDashboard',
  DataLine:           'TrendingUp',
  Discount:           'Tag',
  GoodsFilled:        'ShoppingBag',
  Goods:              'ShoppingBag',
  Handbag:            'ShoppingBag',
  Management:         'ClipboardList',
  Money:              'DollarSign',
  Odometer:           'Gauge',
  Promotion:          'Megaphone',
  QuartzWatch:        'Watch',
  Sell:               'BadgeDollarSign',
  Shop:               'Store',
  ShoppingBag:        'ShoppingBag',
  ShoppingCartFull:   'ShoppingCart',
  ShoppingCart:       'ShoppingCart',
  ShoppingTrolley:    'ShoppingCart',
  SoldOut:            'PackageX',
  TakeawayBox:        'Package',
  Trophy:             'Trophy',
  TrophyBase:         'Award',
  Wallet:             'Wallet',
  WalletFilled:       'Wallet',
  WatchIcon:          'Watch',
  Watch:              'Watch',

  // Technology
  Cellphone:          'Smartphone',
  ChromeFilled:       'Globe',
  Connection:         'Link2',
  Cpu:                'Cpu',
  Iphone:             'Smartphone',
  Key:                'Key',
  Link:               'Link',
  Lock:               'Lock',
  MagicStick:         'Wand2',
  Magnet:             'Magnet',
  Monitor:            'Monitor',
  Mouse:              'Mouse',
  Notebook2:          'Laptop',
  Unlock:             'Unlock',
  Van:                'Truck',
  Ship:               'Ship',
  Bicycle:            'Bike',

  // Nature / Weather
  Cloudy:             'Cloud',
  Drizzling:          'CloudDrizzle',
  Moon:               'Moon',
  MoonNight:          'MoonStar',
  MostlyCloudy:       'CloudSun',
  PartlyCloudy:       'CloudSun',
  Pouring:            'CloudRain',
  Sunrise:            'Sunrise',
  Sunset:             'Sunset',
  Sunny:              'Sun',
  Umbrella:           'Umbrella',
  WindPower:          'Wind',

  // Sports
  Baseball:           'CircleDot',
  Basketball:         'CircleDot',
  Football:           'CircleDot',
  Soccer:             'CircleDot',

  // Home / Office
  CollectionTag:      'Tag',
  Collection:         'Bookmark',
  Flag:               'Flag',
  GoldMedal:          'Medal',
  HomeFilled:         'Home',
  House:              'Home',
  Medal:              'Medal',
  OfficeBuilding:     'Building2',
  ReadingLamp:        'Lamp',
  Reading:            'BookOpen',
  Refrigerator:       'Box',
  School:             'School',
  Stopwatch:          'Timer',
  Timer:              'Timer',
  Clock:              'Clock',
  Calendar:           'Calendar',
  Crop:               'Crop',
  Headset:            'Headphones',
  Lightning:          'Zap',
  NoSmoking:          'CigaretteOff',
  Smoking:            'Cigarette',
  SuitcaseLine:       'Luggage',
  Suitcase:           'Luggage',
  Tools:              'Wrench',
  ToiletPaper:        'Scroll',
  TurnOff:            'PowerOff',
  PriceTag:           'Tag',

  // Food & Drink (no Lucide equivalent → custom SVG)
  Apple:              null,
  Bowl:               null,
  Brush:              null,
  BrushFilled:        null,
  Burger:             null,
  Cherry:             null,
  Chicken:            null,
  Coffee:             null,
  CoffeeCup:          null,
  ColdDrink:          null,
  Dessert:            null,
  Dish:               null,
  DishDot:            null,
  Eleme:              null,
  ElemeFilled:        null,
  ElementPlus:        null,
  Food:               null,
  ForkSpoon:          null,
  Fries:              null,
  GobletFull:         null,
  GobletSquareFull:   null,
  GobletSquare:       null,
  Goblet:             null,
  Grape:              null,
  HotWater:           null,
  IceCreamRound:      null,
  IceCreamSquare:     null,
  IceCream:           null,
  IceDrink:           null,
  IceTea:             null,
  KnifeFork:          null,
  Lollipop:           null,
  MilkTea:            null,
  Mug:                null,
  Orange:             null,
  Pear:               null,
  Sugar:              null,
  Watermelon:         null,

  // Brand / Custom
  Box:                null,
  Opportunity:        null,
}

// ============================================================================
// 自定义 SVG 路径数据（24×24 viewBox，stroke-only）
// ============================================================================
const CUSTOM_SVG_PATHS = {
  // Info — just the "i" glyph, no enclosing circle
  InfoFilled: `<path d="M12 16v-4"/>
    <path d="M12 8h.01"/>`,

  // Food & Drink
  Apple: `<path d="M12 3c-1 0-3 1-3 3"/>
    <path d="M9 6c0 0-4 1-4 8a7 7 0 0 0 14 0c0-7-4-8-4-8"/>
    <path d="M9 14c0 0 .5 2 3 2s3-2 3-2"/>`,

  Bowl: `<path d="M4 11h16"/>
    <path d="M4 11a8 8 0 0 0 16 0"/>
    <path d="M9 19h6"/>`,

  Brush: `<path d="M3 21l9-9"/>
    <path d="M12.2 6.2a2.5 2.5 0 0 1 3.6 3.6L10 16H6v-4z"/>`,

  BrushFilled: `<path d="M3 21l9-9"/>
    <path d="M12.2 6.2a2.5 2.5 0 0 1 3.6 3.6L10 16H6v-4z"/>`,

  Burger: `<path d="M4 13h16"/>
    <path d="M4 9h16"/>
    <path d="M4 17h16"/>
    <rect x="2" y="6" width="20" height="12" rx="2"/>`,

  Cherry: `<circle cx="8" cy="16" r="3"/>
    <circle cx="16" cy="16" r="3"/>
    <path d="M8 13V7"/>
    <path d="M16 13V7"/>
    <path d="M8 7c0-3 8-3 8 0"/>`,

  Chicken: `<path d="M7 4c0-1.5 2-2.5 4-2s4 2 4 4c0 2-2 3-3 3"/>
    <path d="M8 9c-2 1-3 3-3 5a5 5 0 0 0 10 0c0-2-1-4-3-5"/>`,

  Coffee: `<path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
    <line x1="6" x2="6" y1="2" y2="4"/>
    <line x1="10" x2="10" y1="2" y2="4"/>
    <line x1="14" x2="14" y1="2" y2="4"/>`,

  CoffeeCup: `<path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>`,

  ColdDrink: `<path d="M8 2h8"/>
    <path d="M9 2v3l-3 4h12l-3-4V2"/>
    <path d="M6 9v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/>
    <path d="M10 13v3"/>
    <path d="M14 13v3"/>`,

  Dessert: `<circle cx="12" cy="13" r="5"/>
    <path d="M12 8V3"/>
    <path d="M9 3h6"/>
    <path d="M9 13h6"/>`,

  Dish: `<ellipse cx="12" cy="12" rx="10" ry="6"/>
    <path d="M12 6v12"/>`,

  DishDot: `<ellipse cx="12" cy="12" rx="10" ry="6"/>
    <path d="M12 6v12"/>
    <circle cx="12" cy="12" r="2"/>`,

  Eleme: `<circle cx="12" cy="12" r="9"/>
    <path d="M12 8v4l3 3"/>`,

  ElemeFilled: `<circle cx="12" cy="12" r="9"/>
    <path d="M12 8v4l3 3"/>`,

  ElementPlus: `<path d="M12 3L3 8v8l9 5 9-5V8z"/>
    <path d="M3 8l9 5 9-5"/>
    <path d="M12 13v8"/>`,

  Food: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>`,

  ForkSpoon: `<path d="M6 2v6"/>
    <path d="M6 14v8"/>
    <path d="M4 8h4a2 2 0 0 0 0-6H4"/>
    <path d="M18 2l-2 6 2 4-2 10"/>`,

  Fries: `<path d="M5 4h2v14H5z"/>
    <path d="M9 4h2v14H9z"/>
    <path d="M13 4h2v14h-2z"/>
    <path d="M3 18h18"/>`,

  GobletFull: `<path d="M6 3h12l-3 9H9L6 3z"/>
    <path d="M12 12v6"/>
    <path d="M8 21h8"/>`,

  GobletSquareFull: `<rect x="6" y="3" width="12" height="9"/>
    <path d="M12 12v6"/>
    <path d="M8 21h8"/>`,

  GobletSquare: `<rect x="6" y="3" width="12" height="9"/>
    <path d="M12 12v6"/>
    <path d="M8 21h8"/>`,

  Goblet: `<path d="M6 3h12l-3 9H9L6 3z"/>
    <path d="M12 12v6"/>
    <path d="M8 21h8"/>`,

  Grape: `<circle cx="8" cy="8" r="2"/>
    <circle cx="12" cy="6" r="2"/>
    <circle cx="16" cy="8" r="2"/>
    <circle cx="10" cy="12" r="2"/>
    <circle cx="14" cy="12" r="2"/>
    <circle cx="12" cy="16" r="2"/>
    <path d="M12 4V2"/>`,

  HotWater: `<path d="M5 8h14v12H5z"/>
    <path d="M8 4v4"/>
    <path d="M12 2v6"/>
    <path d="M16 4v4"/>`,

  IceCreamRound: `<circle cx="12" cy="9" r="5"/>
    <path d="M12 14v7"/>`,

  IceCreamSquare: `<rect x="7" y="4" width="10" height="10"/>
    <path d="M12 14v7"/>`,

  IceCream: `<path d="M7 4c0-2.8 2.2-5 5-5s5 2.2 5 5a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"/>
    <path d="M12 9v12"/>`,

  IceDrink: `<path d="M7 2h10"/>
    <path d="M9 2v2l-3 4h12l-3-4V2"/>
    <path d="M6 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>`,

  IceTea: `<path d="M7 2h10"/>
    <path d="M9 2v4H6l3 4h6l3-4h-3V2"/>
    <path d="M6 10v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10"/>`,

  KnifeFork: `<path d="M14 2v6a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V2"/>
    <path d="M14 14v8"/>
    <path d="M7 2v4"/>
    <path d="M7 10v12"/>
    <path d="M5 8h4"/>`,

  Lollipop: `<circle cx="12" cy="9" r="5"/>
    <path d="M15.5 12.5L20 20"/>
    <path d="M12 14v7"/>`,

  MilkTea: `<path d="M7 4h10l-1 5H8L7 4z"/>
    <path d="M6 9h12l-1 12H7L6 9z"/>
    <path d="M10 4c0-1 .7-2 2-2s2 1 2 2"/>`,

  Mug: `<path d="M17 8h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>`,

  Orange: `<circle cx="12" cy="13" r="7"/>
    <path d="M12 6V3"/>
    <path d="M9 4l3 2 3-2"/>`,

  Pear: `<path d="M12 3C9 3 7 5 7 8c0 2 1 3.5 1 3.5C5.5 13 4 15 4 17a8 8 0 0 0 16 0c0-2-1.5-4-4-5.5 0 0 1-1.5 1-3.5 0-3-2-5-5-5z"/>`,

  Sugar: `<path d="M7 2h10"/>
    <rect x="6" y="6" width="12" height="14" rx="2"/>
    <path d="M10 10h4"/>
    <path d="M12 8v4"/>`,

  Watermelon: `<circle cx="12" cy="13" r="8"/>
    <path d="M4.5 13h15"/>
    <path d="M9 17l1-2"/>
    <path d="M14 17l-1-2"/>
    <path d="M12 3v2"/>`,

  Box: `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5"/>
    <path d="M12 22V12"/>`,

  Opportunity: `<path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6l-1 3H9l-1-3C6.5 13.5 5 11.5 5 9a7 7 0 0 1 7-7z"/>
    <path d="M9 18h6"/>
    <path d="M9 21h6"/>`,
}

// ============================================================================
// 工具函数：将 Lucide 节点数组转换为 SVG 元素字符串
// ============================================================================
function lucideNodesToSvg(nodes) {
  return nodes.map(([tag, attrs]) => {
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ')
    return `    <${tag} ${attrStr}/>`
  }).join('\n')
}

// ============================================================================
// 生成单个 .vue 文件内容
// ============================================================================
function generateVueFile(componentName, svgContent) {
  return `<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
${svgContent}
  </svg>
</template>
<script lang="ts" setup>
defineOptions({
  name: '${componentName}',
})
</script>
`
}

// ============================================================================
// 主流程
// ============================================================================
let generated = 0
let skipped = 0
let custom = 0

for (const [epName, lucideName] of Object.entries(EP_TO_LUCIDE)) {
  // 将 PascalCase 转换为 kebab-case 文件名
  const fileName = epName
    .replace(/([A-Z])/g, '-$1')
    .replace(/^-/, '')
    .toLowerCase() + '.vue'

  const filePath = path.join(COMPONENTS_DIR, fileName)

  let svgContent = ''

  if (lucideName && lucideIcons[lucideName]) {
    // 使用 Lucide 图标数据
    svgContent = lucideNodesToSvg(lucideIcons[lucideName])
    generated++
  } else if (CUSTOM_SVG_PATHS[epName]) {
    // 使用自定义 SVG 路径
    svgContent = CUSTOM_SVG_PATHS[epName]
      .split('\n')
      .map(l => '    ' + l.trim())
      .join('\n')
    custom++
  } else {
    // 无映射且无自定义：跳过（保留原有文件）
    skipped++
    if (!lucideName) {
      console.warn(`  [SKIP] ${epName}: no custom SVG defined`)
    } else {
      console.warn(`  [WARN] ${epName} → ${lucideName}: not found in Lucide`)
    }
    continue
  }

  fs.writeFileSync(filePath, generateVueFile(epName, svgContent), 'utf-8')
}

console.log(`\n✓ Generated: ${generated} (Lucide) + ${custom} (custom) = ${generated + custom} icons`)
console.log(`  Skipped: ${skipped}`)
