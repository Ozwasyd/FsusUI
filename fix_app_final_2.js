const fs = require('fs');
const path = 'packages/demo-app/src/App.vue';
let content = fs.readFileSync(path, 'utf8');

// Fix TreeSelect Test ID to match the test script exactly
content = content.replace(/data-testid="unique-tree-select"/g, 'data-testid="unique-tree-select"');
// Wait, I already fixed it to wrapper. Let's make sure test matches app.

fs.writeFileSync(path, content);
