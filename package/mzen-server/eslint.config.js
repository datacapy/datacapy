// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

const ignores = ['**/*.js']

export default tseslint.config(
  {
    ...eslint.configs.recommended,
    ignores,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    ignores,
  })),
  {
    files: ['**/*.{ts,mts,cts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/no-require-imports': [
        'error',
        { allowAsImport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_.*$|^_$',
          varsIgnorePattern: '^_.*$|^_$',
          caughtErrorsIgnorePattern: '^_.*$|^_$',
        },
      ],
    },
  }
)
