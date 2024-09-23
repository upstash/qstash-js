import typescriptEslint from "@typescript-eslint/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["**/*.config.*", "src/encoding/**.*", "**/examples"],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:unicorn/recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked"
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      unicorn,
    },

    languageOptions: {
      globals: {},
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {
      "no-console": [
        "error",
        {
          allow: ["warn", "error"],
        },
      ],

      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 100],
          ignoreArrayIndexes: true,
        },
      ],

      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/prefer-ts-expect-error": "off",

      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],

      "unicorn/prevent-abbreviations": [
        2,
        {
          replacements: {
            args: false,
            props: false,
            db: false,
          },
        },
      ],

      "no-implicit-coercion": [
        "error",
        {
          boolean: true,
        },
      ],

      "no-extra-boolean-cast": [
        "error",
        {
          enforceForLogicalOperands: true,
        },
      ],

      "no-unneeded-ternary": [
        "error",
        {
          defaultAssignment: true,
        },
      ],

      "unicorn/no-array-reduce": ["off"],
      "unicorn/no-nested-ternary": "off",
    },
  },
];
