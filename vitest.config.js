import { defineConfig } from "vitest/config";

// Logique pure du site (src/lib) et des edge functions (supabase/functions/_shared).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}", "supabase/functions/**/*.test.ts"],
  },
});
