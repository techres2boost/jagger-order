import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BoxLogo } from "@/components/BoxLogo";
import { DeliveryTrackingMap } from "@/components/DeliveryTrackingMap";
import { OrderChat } from "@/components/OrderChat";
import { hasValidCoords } from "@/lib/geo";
import { ArrowLeft, PackageX } from "lucide-react";

// Page dédiée de suivi de livraison : carte de tracking + chat, sur une route
// séparée de la page de commande. ssr:false car Leaflet accède à `window`.
export const Route = createFileRoute("/_authenticated/orders/$orderId/tracking")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
  },
  component: TrackingPage,
});

interface TrackingOrderRow {
  id: string;
  status: string;
  user_id: string;
  assigned_livreur_id: string | null;
  delivered_at: string | null;
  // Colonnes présentes en base mais absentes des types générés (stale).
  lat?: number | null;
  lng?: number | null;
}

// Suivi accessible dès qu'un livreur est assigné, tant que la commande n'est ni
// annulée/expirée/refusée, ni livrée depuis longtemps (> 24 h). Miroir de la
// fenêtre d'accès du chat (can_access_order_chat) côté base.
function canTrack(order: TrackingOrderRow): boolean {
  if (!order.assigned_livreur_id) return false;
  if (["cancelled", "expired", "refused"].includes(order.status)) return false;
  if (order.status === "delivered") {
    if (!order.delivered_at) return false;
    return Date.now() - new Date(order.delivered_at).getTime() < 24 * 3600 * 1000;
  }
  return true;
}

function TrackingPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<TrackingOrderRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileCoords, setProfileCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data: u }) => {
      if (!mounted || !u.user) return;
      setCurrentUserId(u.user.id);
      // profiles.lat/lng existent en base mais pas dans les types générés (stale) :
      // contournement par cast, comme ailleurs dans le projet.
      supabase
        .from("profiles" as never)
        .select("lat, lng")
        .eq("id", u.user.id)
        .maybeSingle()
        .then(({ data }) => {
          const coords = data as { lat: number | null; lng: number | null } | null;
          if (mounted && hasValidCoords(coords)) setProfileCoords(coords);
        });
    });

    supabase
      .from("orders")
      .select("id, status, user_id, assigned_livreur_id, delivered_at, lat, lng")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setOrder((data as TrackingOrderRow | null) ?? null);
        setLoading(false);
      });

    // Suivi du statut : si la commande quitte "delivering" pendant qu'on est sur
    // la page, on bascule sur l'état "plus en livraison".
    const channel = supabase
      .channel(`order-tracking-status-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => setOrder(payload.new as TrackingOrderRow),
      )
      .subscribe();

    // Cleanup Realtime (statut) au démontage. La carte et le chat nettoient leurs
    // propres canaux (position + messages) à leur propre démontage.
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  // Commande absente (accès non autorisé / inexistante) ou hors fenêtre de suivi
  // (pas de livreur assigné, ou annulée/expirée/refusée, ou livrée depuis
  // longtemps) : on n'affiche jamais une carte/chat vides.
  if (!order || !canTrack(order)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <BoxLogo size={56} showWordmark={false} />
        <div className="mt-6 w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <PackageX className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-black">Suivi indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Le suivi n'est pas disponible pour cette commande.
          </p>
          <Link
            to="/commande/$id"
            params={{ id: orderId }}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 font-bold text-brand-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à la commande
          </Link>
        </div>
      </div>
    );
  }

  // Adresse de livraison (marker fixe) : profil client si dispo, sinon commande.
  const orderCoords = { lat: order.lat ?? null, lng: order.lng ?? null };
  const dest = profileCoords ?? (hasValidCoords(orderCoords) ? orderCoords : null);

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Link
            to="/commande/$id"
            params={{ id: orderId }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
            aria-label="Retour à la commande"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <BoxLogo size={30} showWordmark={false} />
          <h1 className="text-lg font-black">Suivi de livraison</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-4">
        {dest ? (
          <DeliveryTrackingMap orderId={order.id} destLat={dest.lat} destLng={dest.lng} />
        ) : (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Position de livraison indisponible.
          </div>
        )}
        {currentUserId && <OrderChat orderId={order.id} currentUserId={currentUserId} />}
      </main>
    </div>
  );
}
