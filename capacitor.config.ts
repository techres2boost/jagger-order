import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
appId: "com.res2boost.Jagger",
  appName: "Jagger",
  webDir: ".output/public",
  server: {
    // L'app native est un conteneur qui charge le web déployé (SSR TanStack/Nitro) :
    // le build mobile ne produit pas d'index.html autonome, donc le binaire ne
    // s'auto-suffit pas. Cette URL DOIT pointer vers le domaine réellement en
    // ligne, sinon l'app affiche une page vide.
    url: "https://jagger-order.vercel.app/",
    cleartext: false,
    allowNavigation: ["*.vercel.app", "*.supabase.co"]
  }
};

export default config;
