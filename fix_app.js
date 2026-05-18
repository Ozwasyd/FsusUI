const fs = require('fs');
const content = fs.readFileSync('packages/demo-app/src/App.vue', 'utf8');

let fixed = content
  // Fix Radio Group
  .replace(/<el-radio-group v-model="radio"><el-radio label="1">Option 1<\/el-radio><el-radio label="2">Option 2<\/el-radio><\/el-radio-group>/g, 
           '<el-radio-group v-model="radio"><el-radio value="1">Option 1</el-radio><el-radio value="2">Option 2</el-radio></el-radio-group>')
  .replace(/<el-radio-group v-model="radio"><el-radio-button label="1">Option 1<\/el-radio-button><el-radio-button label="2">Option 2<\/el-radio-button><\/el-radio-group>/g,
           '<el-radio-group v-model="radio"><el-radio-button value="1">Option 1</el-radio-button><el-radio-button value="2">Option 2</el-radio-button></el-radio-group>')
  // Fix Checkbox Group
  .replace(/<el-checkbox-group v-model="checkboxGroup"><el-checkbox label="A">Option A<\/el-checkbox><el-checkbox label="B">Option B<\/el-checkbox><\/el-checkbox-group>/g,
           '<el-checkbox-group v-model="checkboxGroup"><el-checkbox value="A">Option A</el-checkbox><el-checkbox value="B">Option B</el-checkbox></el-checkbox-group>')
  .replace(/<el-checkbox-group v-model="checkboxGroup"><el-checkbox-button label="A">Option A<\/el-checkbox-button><el-checkbox-button label="B">Option B<\/el-checkbox-button><\/el-checkbox-group>/g,
           '<el-checkbox-group v-model="checkboxGroup"><el-checkbox-button value="A">Option A</el-checkbox-button><el-checkbox-button value="B">Option B</el-checkbox-button></el-checkbox-group>')
  // Fix ColorPicker update
  .replace(/@update:model-value="color = \$event \?\? undefined"/g, '@update:modelValue="color = $event || \'\'"')
  // Fix TreeSelect ID
  .replace(/data-testid="unique-tree-select"/g, 'data-testid="tree-select-wrapper"')
  // Fix v-model types in script
  .replace(/const inputNumber = ref<number \| undefined>\(1\)/g, 'const inputNumber = ref<number | undefined>(1)')
  .replace(/const activeCollapse = ref<string \| string\[]>\(\['1']\)/g, 'const activeCollapse = ref<string | string[]>(["1"])');

fs.writeFileSync('packages/demo-app/src/App.vue', fixed);
