import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "vendor/formlane/src/markdown-import.test.ts",
      "vendor/formlane/server/import-style.test.ts",
      "vendor/formlane/server/style-cascade.test.ts",
      "vendor/formlane/server/content.test.ts",
    ],
    environment: "node",
  },
});
