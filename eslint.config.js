import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  // Edge functions Deno : hors du périmètre de ce lint (runtime et imports différents).
  { ignores: ["dist/**", "node_modules/**", "supabase/functions/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off", // texte français avec apostrophes
      "react-hooks/set-state-in-effect": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
    },
    settings: { react: { version: "18.3" } },
  },
  {
    files: ["**/*.test.{js,jsx}", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
