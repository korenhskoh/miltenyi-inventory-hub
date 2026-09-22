import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: true,
        document: true,
        localStorage: true,
        fetch: true,
        console: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        URLSearchParams: true,
        FormData: true,
        Blob: true,
        URL: true,
        alert: true,
        confirm: true,
        navigator: true,
        Intl: true,
        Image: true,
        FileReader: true,
        AbortController: true,
        Headers: true,
        HTMLElement: true,
        Event: true,
        MutationObserver: true,
        matchMedia: true,
        requestAnimationFrame: true,
        cancelAnimationFrame: true,
        IntersectionObserver: true,
        ResizeObserver: true,
        performance: true,
        structuredClone: true,
        crypto: true,
        TextEncoder: true,
        btoa: true,
        atob: true,
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      ...reactHooks.configs.recommended.rules,
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: {
        process: true,
        console: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        Buffer: true,
        URL: true,
        URLSearchParams: true,
        // Node 18+ has these globally; the AI provider layer uses them.
        fetch: true,
        AbortController: true,
        performance: true,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        process: true,
        console: true,
        fetch: true,
        setTimeout: true,
        clearTimeout: true,
        Buffer: true,
        URL: true,
        URLSearchParams: true,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  prettier,
  // Vendored from the Bklit registry (shadcn `add @bklit/...`). TypeScript
  // sources that this project's JS-only ESLint setup cannot parse, and that we
  // do not own — they are replaced by re-running the registry, not edited.
  { ignores: ['dist/', 'node_modules/', '*.cjs', 'src/charts/**', 'src/lib/utils.ts'] },
];
