const fs = require('fs');
const path = 'packages/demo-app/src/App.vue';
let content = fs.readFileSync(path, 'utf8');

// 1. 修复 TreeSelect 的测试 ID 和包装层 (确保 Playwright 能点到)
content = content.replace(/<h3>TreeSelect<\/h3><div class="tree-select-test-wrapper" data-testid="tree-select-wrapper">/, 
                          '<h3>TreeSelect</h3><div class="tree-select-test-wrapper" data-testid="unique-tree-select">');

// 2. 补全 Select 的测试 ID
content = content.replace(/<div data-testid="activity-zone-select">/, '<div data-testid="activity-zone-select-wrapper">');

fs.writeFileSync(path, content);
