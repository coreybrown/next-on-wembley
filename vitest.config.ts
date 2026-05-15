import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    css: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "prisma/**/*.{test,spec}.ts"],
    exclude: [
      "node_modules/**",
      ".next/**",
      "prisma/migrations/**",
      "public/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/*.config.*", "prisma/migrations/**", ".next/**"],
    },
  },
});
