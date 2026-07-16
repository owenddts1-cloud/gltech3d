import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // O tsconfig usa `jsx: "preserve"` (o Next transforma no build). Nos testes não
  // há Next, então o esbuild preservaria o JSX e o render quebraria com "React is
  // not defined". `automatic` usa o runtime novo — sem import de React, sem dep nova.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    globals: true,
    coverage: { provider: "v8", reporter: ["text", "html"] },
    exclude: ["node_modules", ".next", "dist", "tests/e2e/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
