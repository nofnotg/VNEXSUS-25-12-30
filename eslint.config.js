// Flat config for ESLint v9
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const jsFiles = [
  'src/**/*.js',
  'src/**/*.mjs',
];
const tsFiles = [
  'src/**/*.ts',
];

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'backend/**',
      'frontend/**',
      'public/**',
      'pages/**',
      'outputs/**',
      'temp/**',
      'tests/**',
      '*.js',
      '*.cjs',
      '*.mjs',
    ],
  },
  { ...eslint.configs.recommended, files: [...jsFiles, ...tsFiles] },
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: tsFiles })),
  {
    files: [...jsFiles, ...tsFiles],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        AbortController: 'readonly',
        Blob: 'readonly',
        Buffer: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
        exports: 'readonly',
        fetch: 'readonly',
        location: 'readonly',
        module: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        require: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: [
      'src/bridge/**/*.{ts,js}',
      'src/shared/**/*.{ts,js}',
      'src/controllers/**/*.js',
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
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
    files: [
      'src/shared/logging/logger.{js,ts}',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
