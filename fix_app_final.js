const fs = require('fs');
const path = 'packages/demo-app/src/App.vue';
let content = fs.readFileSync(path, 'utf8');

// Final Script Level Type Fixes
content = content.replace(/const radio = ref\('1'\)/, "const radio = ref<string | number | boolean>('1')");
content = content.replace(/const checkbox = ref\(true\)/, "const checkbox = ref<any>(true)");
content = content.replace(/const checkboxGroup = ref\(\['A']\)/, "const checkboxGroup = ref<any[]>(['A'])");
content = content.replace(/const inputNumber = ref<number \| undefined>\(1\)/, "const inputNumber = ref<any>(1)");
content = content.replace(/const switchValue = ref\(true\)/, "const switchValue = ref<any>(true)");
content = content.replace(/const slider = ref\(50\)/, "const slider = ref<any>(50)");
content = content.replace(/const transferValue = ref\(\[]\)/, "const transferValue = ref<any[]>([])");
content = content.replace(/const activeTab = ref\('first'\)/, "const activeTab = ref<any>('first')");
content = content.replace(/const activeCollapse = ref<string \| string\[]>\(\["1"]\)/, "const activeCollapse = ref<any>(['1'])");

// Fix Radio/Checkbox Template Props (use label for everything to be safe)
content = content.replace(/<el-radio value="1">/g, '<el-radio label="1">');
content = content.replace(/<el-radio value="2">/g, '<el-radio label="2">');
content = content.replace(/<el-radio-button value="1">/g, '<el-radio-button label="1">');
content = content.replace(/<el-radio-button value="2">/g, '<el-radio-button label="2">');
content = content.replace(/<el-checkbox value="A">/g, '<el-checkbox label="A">');
content = content.replace(/<el-checkbox value="B">/g, '<el-checkbox label="B">');
content = content.replace(/<el-checkbox-button value="A">/g, '<el-checkbox-button label="A">');
content = content.replace(/<el-checkbox-button value="B">/g, '<el-checkbox-button label="B">');

fs.writeFileSync(path, content);
console.log('App.vue types and props finalized.');
