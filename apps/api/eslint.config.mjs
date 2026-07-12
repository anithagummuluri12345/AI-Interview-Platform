import ts from "typescript-eslint";
import js from "@eslint/js";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  }
);
