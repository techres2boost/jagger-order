"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BoxLogo } from "@/components/BoxLogo";
import { EnableNotifications } from "@/components/EnableNotifications";
import { fmt } from "@/lib/format";
import { toast } from "sonner";
import { MapPin, Phone, CheckCircle2, Navigation, X } from "lucide-react";
import { signAddressPhoto } from "@/lib/address-photo";
import { DeliveryBroadcastStatus } from "@/components/DeliveryBroadcastStatus";

// Statuts d'une commande "active/en cours" pour un livreur : proposition à
// accepter (ready) + livraison en cours (delivering). Le chat n'existe lui que
// pendant "delivering" (cf. RLS can_access_order_chat).
export const DRIVER_ACTIVE_STATUSES = ["ready", "delivering"] as const;

interface OrderRow {
  id: string;
  status: string;
  customer_name: string;
  phone: string;
  address?: string | null;
  address_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  total: number;
  assigned_livreur_id?: string | null;
  assignment_expires_at?: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  name: string;
  size: string | null;
  qty: number;
  unit_price: number;
}

interface ItemOptionRow {
  option_name: string;
  option_price: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  accepted: "En préparation",
  ready: "Prête",
  delivering: "En livraison",
  delivered: "Livrée",
  refused: "Refusée",
  expired: "Expirée",
  cancelled: "Annulée",
};

// Construit et ouvre un itinéraire Google Maps vers la destination de livraison.
// Origine = géolocalisation navigateur si disponible, sinon omise (Google
// utilise alors la position actuelle par défaut). Ouverture dans un nouvel onglet.
function openItinerary(order: OrderRow) {
  const destination =
    order.lat != null && order.lng != null
      ? `${order.lat},${order.lng}`
      : order.address
        ? encodeURIComponent(order.address)
        : null;

  if (!destination) {
    toast.error("Adresse de livraison indisponible.");
    return;
  }

  const base = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  // Onglet ouvert de façon synchrone (dans le geste utilisateur) pour éviter
  // le blocage popup après l'appel asynchrone de géolocalisation.
  const tab = window.open("", "_blank");
  const finish = (url: string) => {
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(`${base}&origin=${pos.coords.latitude},${pos.coords.longitude}`),
      () => finish(base),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  } else {
    finish(base);
  }
}

// Liste des commandes actives assignées au livreur + modal de détails (position
// partagée + chat inline). Comportement identique à l'ancien écran /livreur ;
// extrait en composant pour être monté par la route /driver/orders.
export function DriverOrders() {
  const [livreurId, setLivreurId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, OrderItemRow[]>>({});
  const [itemOptions, setItemOptions] = useState<Record<string, ItemOptionRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // Miniature de la photo du logement pour la commande ouverte (aide au repérage).
  const [addressPhotoUrl, setAddressPhotoUrl] = useState<string | null>(null);
  // Horloge pour le compte à rebours d'acceptation (2 min) des propositions.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: livreur } = await supabase
        .from("livreurs")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!mounted || !livreur) {
        setLoading(false);
        return;
      }
      setLivreurId(livreur.id);

      await loadOrders(livreur.id);
      if (!mounted) return;
      setLoading(false);

      channel = supabase
        .channel(`livreur-orders-${livreur.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `assigned_livreur_id=eq.${livreur.id}`,
          },
          () => loadOrders(livreur.id),
        )
        .subscribe();
    }

    async function loadOrders(id: string) {
      // Propositions (ready, en attente d'acceptation) ET livraisons en cours
      // (delivering) assignées à ce livreur.
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("assigned_livreur_id", id)
        .in("status", [...DRIVER_ACTIVE_STATUSES]);
      if (error) {
        toast.error(error.message);
        return;
      }
      const list = (ordersData as OrderRow[]) ?? [];
      if (!mounted) return;
      setOrders(list);

      const orderIds = list.map((o) => o.id);
      if (orderIds.length === 0) {
        setItems({});
        setItemOptions({});
        return;
      }

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      if (!mounted || !itemsData) return;
      const grouped: Record<string, OrderItemRow[]> = {};
      (itemsData as OrderItemRow[]).forEach((it) => {
        (grouped[it.order_id] ||= []).push(it);
      });
      setItems(grouped);

      const itemIds = (itemsData as OrderItemRow[]).map((it) => it.id);
      if (itemIds.length === 0) {
        setItemOptions({});
        return;
      }
      const { data: optionsData } = await supabase
        .from("order_item_options")
        .select("order_item_id, option_name, option_price")
        .in("order_item_id", itemIds);
      if (!mounted || !optionsData) return;
      const optMap: Record<string, ItemOptionRow[]> = {};
      optionsData.forEach((o) => {
        (optMap[o.order_item_id] ||= []).push({
          option_name: o.option_name,
          option_price: Number(o.option_price),
        });
      });
      setItemOptions(optMap);
    }

    init();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Le livreur accepte une proposition (ready -> delivering) dans les 2 minutes.
  // Garde-fou serveur : si la proposition a expiré / été réassignée, l'UPDATE ne
  // matche aucune ligne et on informe le livreur.
  async function acceptProposal(orderId: string) {
    if (!livreurId) return;
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "delivering", delivering_at: new Date().toISOString() } as never)
      .eq("id", orderId)
      .eq("assigned_livreur_id", livreurId)
      .eq("status", "ready")
      .select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || (data as { id: string }[]).length === 0) {
      toast.error("Trop tard : la commande a été réattribuée.");
      return;
    }
    toast.success("Commande acceptée — en livraison");
  }

  async function markDelivered(orderId: string) {
    if (!livreurId) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() } as never)
      .eq("id", orderId)
      .eq("assigned_livreur_id", livreurId)
      .eq("status", "delivering");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Commande livrée");
    setSelectedOrderId(null);
  }

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  // Propositions à accepter (ready) vs livraisons en cours (delivering).
  const proposals = orders.filter((o) => o.status === "ready");
  const deliveries = orders.filter((o) => o.status === "delivering");
  const remainingSec = (o: OrderRow) =>
    o.assignment_expires_at
      ? Math.max(0, Math.floor((new Date(o.assignment_expires_at).getTime() - now) / 1000))
      : 0;

  // Récupère et signe la photo du logement liée à la commande ouverte (RLS :
  // le livreur assigné a le droit de lecture). Absente => rien n'est affiché.
  useEffect(() => {
    let cancelled = false;
    setAddressPhotoUrl(null);
    const addressId = selectedOrder?.address_id;
    if (!addressId) return;
    (async () => {
      const { data } = await supabase
        .from("addresses" as never)
        .select("photo_url")
        .eq("id", addressId)
        .maybeSingle();
      const path = (data as { photo_url?: string | null } | null)?.photo_url ?? null;
      const url = await signAddressPhoto(path);
      if (!cancelled) setAddressPhotoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrder?.address_id]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-black/40 hero-gradient px-4 py-3 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <BoxLogo size={36} showWordmark={false} />
          <h1 className="text-lg font-black">Mes livraisons</h1>
          <div className="ml-auto">
            <EnableNotifications role="livreur" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune livraison assignée pour le moment.
          </div>
        ) : (
          <>
            {/* Propositions à accepter (fallback visible du push) : compte à rebours
                de 2 min + bouton Accepter. Passé le délai, réattribution serveur. */}
            {proposals.map((order) => {
              const secs = remainingSec(order);
              const mm = Math.floor(secs / 60);
              const ss = String(secs % 60).padStart(2, "0");
              const expired = secs <= 0;
              return (
                <div
                  key={order.id}
                  className="w-full rounded-3xl border-2 border-brand bg-brand/5 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold">#{order.id.slice(0, 8)}</span>
                    <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-bold text-brand">
                      Nouvelle proposition
                    </span>
                  </div>
                  <div className="mt-2 font-black">{order.customer_name || "Client"}</div>
                  <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                    <span className="line-clamp-1 break-words">
                      {order.address ?? "Adresse non renseignée"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {expired ? (
                        <span className="text-muted-foreground">Délai expiré…</span>
                      ) : (
                        <span className="tabular-nums text-brand">
                          Temps pour accepter : {mm}:{ss}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="rounded-full border px-3 py-2 text-sm font-semibold"
                      >
                        Détails
                      </button>
                      <button
                        type="button"
                        disabled={expired}
                        onClick={() => acceptProposal(order.id)}
                        className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50"
                      >
                        Accepter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {deliveries.map((order) => (
              <div
                key={order.id}
                className="w-full rounded-3xl border bg-card p-4 shadow-sm transition hover:border-brand/40"
              >
                {/* Zone cliquable : ouvre le modal détails (hors bouton ci-dessous). */}
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold">#{order.id.slice(0, 8)}</span>
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="mt-2 font-black">{order.customer_name || "Client"}</div>
                  <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                    <span className="line-clamp-1 break-words">
                      {order.address ?? "Adresse non renseignée"}
                    </span>
                  </div>
                </button>
                {/* Marquage direct depuis la liste (même action que le modal). */}
                <button
                  type="button"
                  onClick={() => markDelivered(order.id)}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand font-bold text-brand-foreground"
                >
                  <CheckCircle2 className="h-5 w-5" /> Marquer comme livrée
                </button>
              </div>
            ))}
          </>
        )}
      </main>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-bold">#{selectedOrder.id.slice(0, 8)}</div>
                <span className="mt-1 inline-flex rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                  {STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="rounded-full border p-2 text-muted-foreground hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 font-black">{selectedOrder.customer_name || "Client"}</div>
            {selectedOrder.phone && (
              <a
                href={`tel:${selectedOrder.phone}`}
                className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"
              >
                <Phone className="h-4 w-4" /> {selectedOrder.phone}
              </a>
            )}

            {/* Adresse cliquable → itinéraire Google Maps */}
            <button
              type="button"
              onClick={() => openItinerary(selectedOrder)}
              className="mt-3 flex w-full items-start justify-between gap-2 rounded-2xl border p-3 text-left hover:border-brand/40"
            >
              <span className="flex items-start gap-1 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                <span className="break-words">
                  {selectedOrder.address ?? "Adresse non renseignée"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">
                <Navigation className="h-4 w-4" /> Itinéraire
              </span>
            </button>

            {/* Photo du logement (si le client en a ajouté une) pour repérer le lieu */}
            {addressPhotoUrl && (
              <div className="mt-3 overflow-hidden rounded-2xl border">
                <img
                  src={addressPhotoUrl}
                  alt="Photo du logement"
                  className="h-40 w-full object-cover"
                />
              </div>
            )}

            <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
              {(items[selectedOrder.id] ?? []).map((it) => (
                <li key={it.id}>
                  <span className="font-semibold">{it.qty}×</span> {it.name}
                  {it.size ? <span className="text-muted-foreground"> · {it.size}</span> : null}
                  {(itemOptions[it.id] ?? []).length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {(itemOptions[it.id] ?? [])
                        .map((o) =>
                          o.option_price > 0
                            ? `${o.option_name} +${fmt(o.option_price)}`
                            : o.option_name,
                        )
                        .join(", ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-2xl bg-brand/10 p-3 text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                À encaisser en espèces
              </div>
              <div className="text-2xl font-black text-brand">
                {fmt(Number(selectedOrder.total))}
              </div>
            </div>

            {selectedOrder.status === "ready" && (
              <button
                disabled={remainingSec(selectedOrder) <= 0}
                onClick={() => acceptProposal(selectedOrder.id)}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand font-bold text-brand-foreground disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5" />
                {remainingSec(selectedOrder) > 0 ? "Accepter la livraison" : "Délai expiré"}
              </button>
            )}

            {selectedOrder.status === "delivering" && (
              <button
                onClick={() => markDelivered(selectedOrder.id)}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand font-bold text-brand-foreground"
              >
                <CheckCircle2 className="h-5 w-5" /> Marquer comme livrée
              </button>
            )}

            {/* Vue de consultation en lecture seule : le partage de position est
                géré globalement (DriverBroadcastProvider), pas déclenché ici. Le
                chat, lui, vit dans l'onglet "Conversations" de la navbar. */}
            {selectedOrder.status === "delivering" && (
              <div className="mt-4 border-t pt-4">
                <DeliveryBroadcastStatus orderId={selectedOrder.id} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
