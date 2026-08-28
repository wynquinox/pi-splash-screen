import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**", "reports/**", "stryker-tmp/**"],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": {
            "arguments": false,
          }
        }
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-floating-promises": "error"
    }
  }
);
