import re

file_path = 'packages/theme-chalk/src/fsus-theme.scss'

replacements = {
    r'\$fsus-black': 'var(--el-color-primary)',
    r'\$fsus-scholarly-blue': 'var(--fsus-scholarly-blue)',
    r'\$fsus-text': 'var(--el-text-color-primary)',
    r'\$fsus-text-muted': 'var(--el-text-color-regular)',
    r'\$fsus-text-soft': 'var(--el-text-color-placeholder)',
    r'\$fsus-border': 'var(--el-border-color)',
    r'\$fsus-border-strong': 'var(--el-border-color-light)',
    r'\$fsus-panel-bg': 'var(--el-bg-color)',
    r'\$fsus-control-bg': 'var(--el-fill-color-lighter)',
    r'\$fsus-subtle-bg': 'var(--el-fill-color)',
    r'\$fsus-float-bg': 'var(--el-bg-color-overlay)',
    r'\$fsus-highlight': 'var(--fsus-highlight)',
    r'\$fsus-shadow-soft': 'var(--el-box-shadow-light)',
    r'\$fsus-shadow-float': 'var(--el-box-shadow)'
}

with open(file_path, 'r') as f:
    content = f.read()

# Handle interpolation #{$fsus-variable}
for scss_var, css_var in replacements.items():
    # Replace #{$fsus-variable} with css_var
    content = re.sub(r'#\{' + scss_var + r'\}', css_var, content)
    # Replace $fsus-variable with css_var
    content = re.sub(scss_var + r'\b', css_var, content)

with open(file_path, 'w') as f:
    f.write(content)
