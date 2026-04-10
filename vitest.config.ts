import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.spec.ts", "**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      exclude: [
        "node_modules",
        "dist",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/migrations/**",
      ],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@core": path.resolve(__dirname, "core"),
      "@domains": path.resolve(__dirname, "domains"),
      "@infrastructure": path.resolve(__dirname, "infrastructure"),
      "@/": path.resolve(__dirname),
    },
  },
});
