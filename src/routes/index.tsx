import { createFileRoute, redirect } from "@tanstack/react-router";

// Ce projet n'a pas de site vitrine : la racine sert directement l'application
// de commande, qui reste hébergée sur "/app" (route canonique, cible du
// `start_url` du manifest PWA et de toute la navigation interne).
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});
