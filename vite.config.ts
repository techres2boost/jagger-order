import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          enabled: false,
          crawlLinks: false,
          routes: []
        }
      }
    }),
    viteTsConfigPaths()
  ],
  css: {
    transformer: 'postcss',
  },
  build: {
    cssMinify: false,  // Désactive complètement la minification CSS
  },
  server: {
    port: 3000
  }
});
