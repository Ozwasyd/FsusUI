const fs = require('fs');
const path = 'packages/theme-chalk/src/fsus-theme.scss';
let content = fs.readFileSync(path, 'utf8');

// 统一 Alert 圆角
content = content.replace(/border-radius: 18px; \/\/ alert/g, 'border-radius: 14px;');
content = content.replace(/\.#{\$namespace}-alert \{\s+border-radius: 18px;/g, '.#{$namespace}-alert {\n  border-radius: 14px;');

// 统一 Autocomplete / Picker 内部项圆角
content = content.replace(/border-radius: 12px;/g, 'border-radius: 14px;');

fs.writeFileSync(path, content);
console.log('Radius unification completed.');
