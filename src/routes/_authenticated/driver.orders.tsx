import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DriverOrders } from "@/components/DriverOrders";
import { DriverNavbar } from "@/components/DriverNavbar";

export const Route = createFileRoute("/_authenticated/driver/orders")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "livreur")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: DriverOrdersPage,
});

function DriverOrdersPage() {
  return (
    <>
      <DriverOrders />
      <DriverNavbar />
    </>
  );
}
