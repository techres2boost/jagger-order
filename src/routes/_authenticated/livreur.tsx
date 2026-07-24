import { createFileRoute, redirect } from "@tanstack/react-router";

// L'ancien écran livreur est désormais /driver/orders (dashboard livreur avec
// navbar globale). On redirige /livreur pour conserver les points d'entrée
// existants (routage post-connexion, deep-links des notifications push).
export const Route = createFileRoute("/_authenticated/livreur")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/driver/orders" });
  },
  component: () => null,
});
