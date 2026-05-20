import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    // ---- ADICIONE ESSE BLOCO DE RULES ABAIXO ----
    rules: {
      // 1. Desativa a exigência de vincular manualmente label e input
      'jsx-a11y/label-has-associated-control': 'off',

      // 2. Se quiser também desativar a regra de forçar readonly nas props de páginas
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      'react/prefer-read-only-props': 'off'
    },
  },
])