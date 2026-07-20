import { createFileRoute, redirect } from "@tanstack/react-router";

// Les statistiques livreurs sont désormais affichées comme une carte dans le
// Dashboard. Cette route dédiée est conservée mais redirige vers /dashboard
// (rétrocompatibilité des anciens liens/favoris).
export const Route = createFileRoute("/_authenticated/admin/livreur-stats")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
