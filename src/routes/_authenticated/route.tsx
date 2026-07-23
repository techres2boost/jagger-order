import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ReviewPopup } from "@/components/ReviewPopup";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (!data.user.email_confirmed_at && !data.user.confirmed_at && !data.user.phone_confirmed_at) {
      throw redirect({ to: "/verify-email" });
    }
    return { user: data.user };
  },
  component: () => (
    <>
      <Outlet />
      {/* Popup d'avis automatique post-livraison (Feature 4), disponible sur
          toutes les pages authentifiées. */}
      <ReviewPopup />
    </>
  ),
});
