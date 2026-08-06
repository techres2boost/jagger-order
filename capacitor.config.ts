import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.box_bite_order",
  appName: "BOX",
  webDir: ".output/public",
  server: {
    // On garde ton URL actuelle pour ne rien casser
    url: "https://box-bite-order.lovable.app/",
    cleartext: false,
    allowNavigation: ["*.lovable.app", "*.supabase.co"]
  }
};

export default config;
