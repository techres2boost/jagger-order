import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.box_bite_order",
  appName: "BOX",
  // Sortie statique du build (nitro / TanStack Start). En mode `server.url`
  // ci-dessous, ce contenu web local n'est qu'un repli : la coquille native
  // charge directement l'URL distante hébergée sur Lovable.
  webDir: ".output/public",
  server: {
    // Coquille native qui charge l'application hébergée (mode "server.url").
    url: "https://box-bite-order.lovable.app/",
    // URL en HTTPS → pas de trafic en clair autorisé.
    cleartext: false,
  },
};

export default config;
