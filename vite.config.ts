// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Le build WEB (déployé par Lovable) reste en SSR/Nitro : `server.entry = "server"`.
// Le build MOBILE (Capacitor/iOS) passe en SPA via `TANSTACK_SPA=true vite build`
// (cf. script "build:mobile"). Le web ne doit JAMAIS être buildé en mode SPA,
// sinon la sortie serveur attendue par l'hébergement Lovable n'est pas produite.
export default defineConfig({
  vite: {
    server: {
      allowedHosts: [".ngrok-free.dev"],
    },
  },
  tanstackStart: process.env.TANSTACK_SPA
    ? { spa: { enabled: true } }
    : { server: { entry: "server" } },
});
