import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config Vitest dédiée (indépendante du build Vite/TanStack). Résout l'alias
// TypeScript "@" → src/ (cf. tsconfig paths) pour que les tests importent comme
// l'app. Environnement `node` : les fonctions testées (geo, order-timing) sont
// pures, sans DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
