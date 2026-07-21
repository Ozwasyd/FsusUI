import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import unicorn from 'eslint-plugin-unicorn'
import vueParser from 'vue-eslint-parser'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/__tests__/**',
      '**/mocks/**',
      '**/setup-mock.ts',
      '**/*.d.ts',
      'build/**',
      'CMakeFiles/**',
      '.cmake/**',
      'vue/internal/**',
      'vue/packages/wasm/.cmake-check/**',
      'vue/packages/wasm/dist/**',
      'vue/packages/wasm/build/**',
      'vue/packages/wasm/*.mjs',
      'pnpm-lock.yaml',
      'CHANGELOG.en-US.md',
      'docs/components.d.ts',
      'coverage/**',
      '.tmp/**',
      'playwright-report/**',
      'vue/playwright-report/**',
      'play/**',
      'ssr-testing/cases/*',
      'docs/.vitepress/i18n/*',
      'docs/.vitepress/crowdin/*',
      'test-results/**',
      'vue/tests/visual/**/*.png',
      'vue/tests/visual/**/__screenshots__/**',
      'extract_all.mjs',
      'finish_phase1.mjs',
      'fix_css.mjs',
      'map-vars.mjs',
      'parse_and_split.mjs',
      'phase2_4_5.js',
      'process.mjs',
      'process_button.js',
      'process_theme.js',
      'run_decouple.mjs',
      'split-fsus-theme.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    rules: {
      'no-useless-assignment': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/require-default-prop': 'off',
    },
  },

  {
    files: ['vue/packages/icons-vue/src/components/*.vue'],
    rules: {
      'vue/no-reserved-component-names': 'off',
    },
  },

  {
    files: ['**/*.{ts,tsx,vue}'],
    rules: {
      'no-undef': 'off',
    },
  },

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
      camelcase: ['error', { properties: 'never' }],
      'no-console': ['warn', { allow: ['error'] }],
      'no-debugger': 'warn',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'no-var': 'error',
      'prefer-const': ['warn', { destructuring: 'all' }],
      'prefer-arrow-callback': 'error',
      'object-shorthand': ['error', 'always', { avoidQuotes: true }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/no-v-text-v-html-on-component': 'off',
      'vue/one-component-per-file': 'off',
      'vue/prefer-import-from-vue': 'off',
      'vue/require-default-prop': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'unicorn/prefer-at': 'off',
      'unicorn/prefer-string-replace-all': 'off',
      'unicorn/prefer-object-from-entries': 'off',
    },
  },

  {
    files: ['**/__tests__/**', '**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx', '**/setup-mock.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'vue/prefer-import-from-vue': 'off',
    },
  },

  {
    files: [
      'vue/packages/components/table/src/**/*.{ts,tsx,vue}',
      'vue/packages/components/tree/src/**/*.{ts,tsx,vue}',
      'vue/packages/components/tree-select/src/**/*.{ts,tsx,vue}',
      'vue/packages/components/tooltip-v2/src/**/*.{ts,tsx,vue}',
    ],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-useless-assignment': 'off',
      'no-empty': 'off',
      'vue/prefer-import-from-vue': 'off',
      'unicorn/prefer-object-from-entries': 'off',
    },
  },

  {
    files: [
      'scripts/**/*.{js,mjs,ts}',
      'vue/packages/icons-vue/build/**/*.{js,mjs,ts}',
      'vue/playwright.config.ts',
      'vue/playwright.reuse.config.ts',
      '.github/**/*.{js,mjs,ts}',
    ],
    rules: {
      'no-console': 'off',
    },
  },
]
