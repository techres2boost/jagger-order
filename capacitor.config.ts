import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.res2boost.Jagger ",
  appName: "Jagger",
  webDir: ".output/public",
  server: {
    url: "https://jagger-order.lovable.app/",
    cleartext: false,
    allowNavigation: ["*.lovable.app", "*.supabase.co"]
  }
};

export default config;
