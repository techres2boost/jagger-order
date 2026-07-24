import { createFileRoute } from "@tanstack/react-router";
import { VitrineSite } from "@/components/VitrineSite";

// Route publique racine « site vitrine ». L'app de commande vit sur "/app".
// Charge en plus la police display « Anton » (autorisée par la CSP :
// fonts.googleapis.com / fonts.gstatic.com).
export const Route = createFileRoute("/")({
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
