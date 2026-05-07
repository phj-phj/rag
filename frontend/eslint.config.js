import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  // 基础 JS 规则
  js.configs.recommended,

  // TypeScript 规则
  ...tseslint.configs.recommended,

  // Vue 规则
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // 变量相关
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // 代码质量
      'eqeqeq': 'error',
      'no-debugger': 'error',
      'no-console': 'warn',

      // 格式相关
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-irregular-whitespace': 'error',

      // Vue 相关
      'vue/no-unused-vars': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    ignores: ['node_modules/', 'dist/', '*.config.js'],
  },
]
