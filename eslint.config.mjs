import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      complexity: ["error", 8],
    },
  },
  {
    // PM2 ecosystem file: plain CommonJS evaluated by Node.
    files: ["ecosystem.config.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "writable", __dirname: "readonly" },
    },
  },
  {
    // Local admin panel page script: plain browser script, served as-is.
    files: ["apps/bot/src/admin/public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { document: "readonly", fetch: "readonly" },
    },
  },
  prettier,
);
