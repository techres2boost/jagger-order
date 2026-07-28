import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Clock, RotateCcw, ShoppingBag, Star, StarOff } from "lucide-react";
import { fmt } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { OrderProgressRing, STEPS } from "@/components/OrderProgressRing";
import { useOrderCountdown } from "@/hooks/use-order-countdown";

export const Route = createFileRoute("/_authenticated/commandes")({
  ssr: false,
  component: CommandesPage,
});

type OrderStatus =
  | "pending"
  | "accepted"
  | "ready"
  | "delivering"
  | "delivered"
  | "refused"
  | "expired"
  | "cancelled";

interface OrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  total: number;
  customer_name: string;
  phone: string;
  address?: string | null;
  special_instructions?: string | null;
  arrival_at: string | null;
  estimated_delivery_at: string | null;
  // Colonne déjà récupérée via select("*") ; sert au calcul du temps de livraison.
  delivered_at?: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  name: string;
  qty: number;
  size: string | null;
  unit_price: number;
  note: string | null;
}

interface OrderItemOptionRow {
  order_item_id: string;
  option_name: string;
  option_price: number;
}

interface OrderRatingRow {
  id: string;
  order_id: string;
  rating: number;
  comment: string | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  ready: "Prête",
  delivering: "En livraison",
  delivered: "Livrée",
  refused: "Refusée",
  expired: "Expirée",
  cancelled: "Annulée",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-warning/20 text-warning",
  accepted: "bg-success/20 text-success",
  ready: "bg-accent-warm/20 text-accent-warm",
  delivering: "bg-accent-warm/20 text-accent-warm",
  delivered: "bg-success/20 text-success",
  refused: "bg-destructive/20 text-destructive",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

// Statuts regroupés par onglet. Le filtre serveur s'appuie dessus (voir loadOrders).
const CURRENT_STATUSES: OrderStatus[] = ["pending", "accepted", "ready", "delivering"];
const HISTORY_STATUSES: OrderStatus[] = ["delivered", "refused", "expired", "cancelled"];

function CommandesPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, OrderItemRow[]>>({});
  const [itemOptions, setItemOptions] = useState<Record<string, OrderItemOptionRow[]>>({});
  const [ratings, setRatings] = useState<Record<string, OrderRatingRow>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"current" | "history">("current");

  // --- Filtres (Feature 1) : statut + montant min/max, appliqués côté serveur ---
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  // Montant appliqué (débounce) pour éviter une requête à chaque frappe.
  const [appliedAmount, setAppliedAmount] = useState<{ min: string; max: string }>({
    min: "",
    max: "",
  });
  // Incrémenté par le Realtime pour redéclencher un rechargement filtré.
  const [refreshKey, setRefreshKey] = useState(0);

  const filtersActive =
    statusFilter !== "all" || appliedAmount.min !== "" || appliedAmount.max !== "";

  function resetFilters() {
    setStatusFilter("all");
    setMinAmount("");
    setMaxAmount("");
  }

  useEffect(() => {
    const t = setTimeout(() => setAppliedAmount({ min: minAmount, max: maxAmount }), 400);
    return () => clearTimeout(t);
  }, [minAmount, maxAmount]);

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      setLoading(true);
      const group = tab === "current" ? CURRENT_STATUSES : HISTORY_STATUSES;
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
      // Statut : soit un statut précis, soit l'ensemble des statuts de l'onglet.
      if (statusFilter === "all") query = query.in("status", group);
      else query = query.eq("status", statusFilter);
      // Montant : bornes optionnelles sur le total de la commande.
      const min = parseFloat(appliedAmount.min);
      if (!Number.isNaN(min)) query = query.gte("total", min);
      const max = parseFloat(appliedAmount.max);
      if (!Number.isNaN(max)) query = query.lte("total", max);
      const { data: ordersData, error } = await query;
      if (error) {
        toast.error(error.message);
        if (isMounted) setLoading(false);
        return;
      }

      const ordersList = (ordersData as OrderRow[]) ?? [];
      if (!isMounted) return;
      setOrders(ordersList);

      const orderIds = ordersList.map((o) => o.id);
      if (orderIds.length === 0) {
        setItems({});
        setRatings({});
        setLoading(false);
        return;
      }

      const [itemsRes, ratingsRes] = await Promise.all([
        supabase.from("order_items").select("*").in("order_id", orderIds),
        supabase.from("order_ratings").select("*").in("order_id", orderIds),
      ]);

      if (isMounted) {
        if (itemsRes.error) {
          toast.error(itemsRes.error.message);
          setItems({});
          setItemOptions({});
        } else {
          const orderItems = itemsRes.data as OrderItemRow[];
          const grouped: Record<string, OrderItemRow[]> = {};
          orderItems
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((item) => {
              grouped[item.order_id] = [...(grouped[item.order_id] ?? []), item];
            });
          setItems(grouped);

          const orderItemIds = orderItems.map((item) => item.id);
          if (orderItemIds.length > 0) {
            const { data: optionsData, error: optionsError } = await supabase
              .from("order_item_options")
              .select("order_item_id, option_name, option_price")
              .in("order_item_id", orderItemIds);
            if (!optionsError && isMounted) {
              const optionsGrouped: Record<string, OrderItemOptionRow[]> = {};
              (optionsData ?? []).forEach((o) => {
                optionsGrouped[o.order_item_id] = [
                  ...(optionsGrouped[o.order_item_id] ?? []),
                  {
                    order_item_id: o.order_item_id,
                    option_name: o.option_name,
                    option_price: Number(o.option_price),
                  },
                ];
              });
              setItemOptions(optionsGrouped);
            }
          } else {
            setItemOptions({});
          }
        }

        if (ratingsRes.error) {
          if (!ratingsRes.error.message.includes('relation "order_ratings" does not exist')) {
            toast.error(ratingsRes.error.message);
          }
          setRatings({});
        } else {
          const map: Record<string, OrderRatingRow> = {};
          (ratingsRes.data as OrderRatingRow[]).forEach((rating) => {
            map[rating.order_id] = rating;
          });
          setRatings(map);
        }

        setLoading(false);
      }
    }

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [tab, statusFilter, appliedAmount, refreshKey]);

  // Realtime : un changement sur les commandes du client redéclenche le
  // rechargement filtré (via refreshKey), en conservant les filtres actifs.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const user = await supabase.auth.getUser();
      const uid = user.data.user?.id;
      if (!uid) return;
      channel = supabase
        .channel(`orders-user-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${uid}` },
          () => setRefreshKey((k) => k + 1),
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const selectedOrders = orders;

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-brand" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Commandes</p>
              <h1 className="text-lg font-black">Mes commandes</h1>
            </div>
          </div>
          <Link
            to="/app"
            className="press inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" /> Menu
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as "current" | "history");
            // Les statuts diffèrent d'un onglet à l'autre : on réinitialise le
            // filtre statut pour éviter une sélection hors-onglet.
            setStatusFilter("all");
          }}
        >
          <TabsList className="gap-2">
            <TabsTrigger value="current">En cours</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            <SectionHeader count={orders.length} label="En cours" />
          </TabsContent>
          <TabsContent value="history">
            <SectionHeader count={orders.length} label="Historique" />
          </TabsContent>
        </Tabs>

        {/* Filtres : statut (dropdown) + montant min/max, combinables, réinitialisables */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Statut</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}
            >
              <SelectTrigger className="h-10 w-44">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(tab === "current" ? CURRENT_STATUSES : HISTORY_STATUSES).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Montant min</label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="0"
              className="h-10 w-28"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Montant max</label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="—"
              className="h-10 w-28"
            />
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="press inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : selectedOrders.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {filtersActive
              ? "Aucune commande ne correspond à ces filtres."
              : tab === "current"
                ? "Aucune commande en cours. Passez une nouvelle commande pour commencer."
                : "Aucun historique de commande pour le moment."}
          </div>
        ) : (
          <div className="space-y-4">
            {selectedOrders.map((order) => {
              const orderItems = items[order.id] ?? [];
              const rating = ratings[order.id];
              return (
                <div
                  key={order.id}
                  className="rounded-[26px] border border-border bg-card p-4 shadow-[0_12px_28px_-20px_rgba(46,30,23,0.4)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_CLASS[order.status]}`}
                        >
                          {STATUS_LABEL[order.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        {order.customer_name} · {fmt(Number(order.total))}
                      </div>
                      {CURRENT_STATUSES.includes(order.status) && order.status !== "pending" && (
                        <OrderCountdownBadge order={order} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === order.id ? null : order.id))
                        }
                        className="press inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold"
                      >
                        Voir la commande
                      </button>
                    </div>
                  </div>

                  {expandedId === order.id && (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-3">
                          {orderItems.map((item) => (
                            <div key={item.id} className="rounded-2xl border bg-background p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold">{item.name}</div>
                                  {item.size ? (
                                    <div className="text-xs text-muted-foreground">{item.size}</div>
                                  ) : null}
                                  {item.note ? (
                                    <div className="mt-1 text-xs italic text-muted-foreground">
                                      « {item.note} »
                                    </div>
                                  ) : null}
                                  {(itemOptions[item.id] ?? []).length > 0 && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {(itemOptions[item.id] ?? [])
                                        .map((o) =>
                                          o.option_price > 0
                                            ? `${o.option_name} +${fmt(o.option_price)}`
                                            : o.option_name,
                                        )
                                        .join(", ")}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-black">
                                    {fmt(Number(item.unit_price) * item.qty)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{item.qty}×</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Avis en lecture seule. La saisie/modification se fait
                        uniquement via le popup automatique post-livraison. */}
                        {rating ? (
                          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-3 text-sm">
                            <p className="font-semibold">Votre note</p>
                            <div className="mt-2 flex items-center gap-1 text-yellow-500">
                              {Array.from({ length: 5 }, (_, index) =>
                                index < rating.rating ? (
                                  <Star key={index} className="h-4 w-4" />
                                ) : (
                                  <StarOff key={index} className="h-4 w-4" />
                                ),
                              )}
                            </div>
                            {rating.comment ? (
                              <p className="mt-2 text-xs text-muted-foreground">{rating.comment}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 rounded-2xl border bg-background p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Statut</span>
                          <span className="font-semibold">{STATUS_LABEL[order.status]}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-semibold">
                            {new Date(order.created_at).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground">Temps de livraison</span>
                          <span className="font-semibold">{formatDeliveryTime(order)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t pt-2">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-black text-brand">{fmt(Number(order.total))}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// Mini-cercle de progression + temps restant, version compacte pour la carte de
// la liste. Réutilise le hook et le composant partagés avec la page de détail.
function OrderCountdownBadge({ order }: { order: OrderRow }) {
  const { minutesRemaining, label } = useOrderCountdown(order);
  if (minutesRemaining == null) return null;
  const stepIndex = STEPS.findIndex((step) => step.key === order.status);
  return (
    <div className="mt-3 flex items-center gap-3">
      <OrderProgressRing stepIndex={stepIndex} variant="compact" />
      <div>
        <div className="text-xl font-black text-brand tabular-nums">{label}</div>
        <div className="text-xs text-muted-foreground">Temps restant estimé</div>
      </div>
    </div>
  );
}

// Temps de livraison = écart entre la création et la livraison (delivered_at,
// colonne déjà présente dans orders). Si elle est absente/vide (commande non
// livrée ou schéma sans la colonne), on l'indique explicitement.
function formatDeliveryTime(order: OrderRow): string {
  if (!order.delivered_at) return "Temps de livraison non disponible";
  const ms = new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Temps de livraison non disponible";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function SectionHeader({ count, label }: { count: number; label: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-black">
            {count} commande{count > 1 ? "s" : ""}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-muted/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-4 w-4" /> Toujours actualisé
        </div>
      </div>
    </div>
  );
}
