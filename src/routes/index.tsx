import { createFileRoute, redirect } from "@tanstack/react-router";
import { VitrineSite } from "@/components/VitrineSite";
import { isStandaloneApp } from "@/lib/isStandaloneApp";

// Route publique racine « site vitrine ». L'app de commande vit sur "/app".
// Charge en plus la police display « Anton » (autorisée par la CSP :
// fonts.googleapis.com / fonts.gstatic.com).
export const Route = createFileRoute("/")({
  // En mode « application installée » (PWA / TWA / wrapper natif), la vitrine
  // marketing n'a pas d'intérêt : on redirige directement vers l'app de
  // commande. En navigateur classique, on laisse s'afficher la vitrine.
  beforeLoad: () => {
    if (isStandaloneApp()) {
      throw redirect({ to: "/app" });
    }
  },
  head: () => ({
    meta: [
      { title: "BOX — Fast-food gourmet : sandwichs, burgers, pizzas" },
      {
        name: "description",
        content:
          "Box, le fast-food gourmet : sandwichs, burgers, pizzas et boissons, à commander en ligne ou en livraison.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
      },
    ],
  }),
  component: VitrineSite,
});
