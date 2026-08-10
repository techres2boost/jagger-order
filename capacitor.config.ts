import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.jagger_order",
  appName: "Jagger",
  webDir: ".output/public",
  server: {
    url: "https://jagger-order.lovable.app/",
    cleartext: false,
    allowNavigation: ["*.lovable.app", "*.supabase.co"]
  }
};

export default config;
