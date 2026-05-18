const fs = require('fs');
const path = 'packages/theme-chalk/src/fsus-theme.scss';
let content = fs.readFileSync(path, 'utf8');

// 1. 强制统一全系统圆角变量（根源控制）
content = content.replace(/--el-border-radius-base: 8px;/g, '--el-border-radius-base: 12px; // 提升基础圆角以增强智感');
content = content.replace(/--el-border-radius-small: 6px;/g, '--el-border-radius-small: 8px;');

// 2. 统一浮动层（Dropdown/Popper）与内部项
// 外部 20px, 内部 14px (公式: 20 - 6 = 14)
content = content.replace(/--el-popover-border-radius: 20px;/g, '--el-popover-border-radius: 20px;');
content = content.replace(/border-radius: 14px; \/\/ Unified with 20px popper/g, 'border-radius: 14px;');

// 3. 统一大容器（Card/Dialog/MessageBox）
content = content.replace(/--el-card-border-radius: 24px;/g, '--el-card-border-radius: 24px;');
content = content.replace(/--el-dialog-border-radius: 24px;/g, '--el-dialog-border-radius: 24px;');

// 4. 强制修复具体组件的“圆角碎块化”
// 修复：Input/Button/Tag 统一
const componentUnification = \`
// 强制统一基础组件圆角
.#{$namespace}-button,
.#{$namespace}-input__wrapper,
.#{$namespace}-textarea__inner,
.#{$namespace}-select-v2__wrapper,
.#{$namespace}-tag,
.#{$namespace}-alert,
.#{$namespace}-message,
.#{$namespace}-notification {
  border-radius: 12px !important; // 全系统基础控件 12px
}

// 强制统一弹出层与列表项
.#{$namespace}-popper,
.#{$namespace}-select-dropdown,
.#{$namespace}-dropdown-menu,
.#{$namespace}-cascader__dropdown,
.#{$namespace}-picker__popper {
  border-radius: 20px !important; // 弹出层容器 20px
  padding: 6px !important;
}

.#{$namespace}-select-dropdown__item,
.#{$namespace}-select-dropdown__option-item,
.#{$namespace}-dropdown-menu__item,
.#{$namespace}-cascader-node,
.#{$namespace}-autocomplete-suggestion li {
  border-radius: 14px !important; // 弹出项 14px (嵌套几何: 20-6)
}

// 强制统一大型卡片与模态框
.#{$namespace}-card,
.#{$namespace}-dialog,
.#{$namespace}-drawer,
.#{$namespace}-message-box {
  border-radius: 24px !important; // 大型容器 24px
}
\`;

// 追加到文件末尾确保最高优先级覆盖
content += componentUnification;

fs.writeFileSync(path, content);
console.log('Global Radius Unification (v3.0) implemented.');
