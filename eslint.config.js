// eslint.config.js — ESLint 10 Flat Config
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import unicorn from 'eslint-plugin-unicorn'
import vueParser from 'vue-eslint-parser'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 全局忽略
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'packages/wasm/dist/**',
      'packages/wasm/build/**',
    ],
  },

  // JS 推荐规则
  js.configs.recommended,

  // TypeScript
  ...tseslint.configs.recommended,

  // Vue 3
  ...pluginVue.configs['flat/recommended'],

  // ── 主配置块 ──
  {
    plugins: { unicorn },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __DEV__: 'readonly',
      },
    },
    rules: {
      // JS
      camelcase: ['error', { properties: 'never' }],
      'no-console': ['warn', { allow: ['error'] }],
      'no-debugger': 'warn',
      'no-var': 'error',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'prefer-arrow-callback': 'error',
      'object-shorthand': ['error', 'always', { avoidQuotes: true }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Vue
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',

      // ES2022 友好规则
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/prefer-object-from-entries': 'error',
    },
  },

  // 测试文件宽松规则
  {
    files: ['**/__tests__/**', '**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
