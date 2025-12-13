// Flat config for ESLint v9
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'backend/**',
      'frontend/**',
      'public/**',
      'outputs/**',
      'temp/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'src/bridge/**/*.{ts,js}',
      'src/shared/**/*.{ts,js}',
      'src/controllers/**/*.js',
      'tests/**/*.js',
    ],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.object.name='console']", message: 'Use logger()' },
      ],
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 80 }],
    },
  },
  {
    files: ['tests/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Allow CommonJS require in tests
      '@typescript-eslint/no-require-imports': 'off',
      // Keep console restriction per team rule; override here if needed
    },
  },
];
