import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  PackageCheck,
  ShoppingBag,
  Star,
  StarOff,
  XCircle,
} from "lucide-react";
import { fmt } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  ready: "bg-blue-500/20 text-blue-600",
  delivering: "bg-blue-500/20 text-blue-600",
  delivered: "bg-success/20 text-success",
  refused: "bg-destructive/20 text-destructive",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const isCurrentStatus = (status: OrderStatus) =>
  status === "pending" || status === "accepted" || status === "ready" || status === "delivering";

const isHistoryStatus = (status: OrderStatus) =>
  status === "delivered" || status === "refused" || status === "expired" || status === "cancelled";

function CommandesPage() {
  const navigate = useNavigate();
  const { add } = useCart();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, OrderItemRow[]>>({});
  const [itemOptions, setItemOptions] = useState<Record<string, OrderItemOptionRow[]>>({});
  const [ratings, setRatings] = useState<Record<string, OrderRatingRow>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadOrders() {
      setLoading(true);
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
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

    async function subscribeToOrders() {
      const user = await supabase.auth.getUser();
      const uid = user.data.user?.id;
      if (!uid) return;

      channel = supabase
        .channel(`orders-user-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${uid}` },
          () => {
            loadOrders();
          },
        )
        .subscribe();
    }

    subscribeToOrders();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const currentOrders = useMemo(
    () => orders.filter((order) => isCurrentStatus(order.status)),
    [orders],
  );

  const historyOrders = useMemo(
    () => orders.filter((order) => isHistoryStatus(order.status)),
    [orders],
  );

  const selectedOrders = tab === "current" ? currentOrders : historyOrders;

  const openRating = (orderId: string) => {
    setRatingOrderId(orderId);
    setRatingValue(ratings[orderId]?.rating ?? 0);
    setRatingComment(ratings[orderId]?.comment ?? "");
  };

  const closeRating = () => {
    setRatingOrderId(null);
    setRatingValue(0);
    setRatingComment("");
    setSavingRating(false);
  };

  async function submitRating(orderId: string) {
    if (ratingValue < 1 || ratingValue > 5) {
      toast.error("Choisissez une note entre 1 et 5 étoiles.");
      return;
    }

    setSavingRating(true);
    const user = await supabase.auth.getUser();
    const uid = user.data.user?.id;
    if (!uid) {
      toast.error("Utilisateur introuvable.");
      setSavingRating(false);
      return;
    }

    const { data, error } = await supabase.from("order_ratings").upsert(
      {
        order_id: orderId,
        user_id: uid,
        rating: ratingValue,
        comment: ratingComment.trim() || null,
      } as never,
      { onConflict: "order_id" },
    );

    if (error) {
      toast.error(error.message);
      setSavingRating(false);
      return;
    }

    setRatings((prev) => ({
      ...prev,
      [orderId]: {
        id: (data as OrderRatingRow[] | null)?.[0]?.id ?? prev[orderId]?.id ?? orderId,
        order_id: orderId,
        rating: ratingValue,
        comment: ratingComment.trim() || null,
      },
    }));
    toast.success("Merci pour votre note !");
    closeRating();
  }

  function addOrderToCart(order: OrderRow) {
    const orderItems = items[order.id] ?? [];
    if (orderItems.length === 0) {
      toast.error("Impossible de recommander : aucun article trouvé.");
      return;
    }

    orderItems.forEach((item) => {
      add({
        itemId: `order-${order.id}-${item.id}`,
        name: item.name,
        size: item.size ?? undefined,
        unitPrice: Number(item.unit_price),
        qty: item.qty,
        note: item.note ?? undefined,
      });
    });

    toast.success("Commande ajoutée au panier.");
    navigate({ to: "/panier" });
  }

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
            to="/"
            className="press inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" /> Menu
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as "current" | "history")}>
          <TabsList className="gap-2">
            <TabsTrigger value="current">En cours</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            <SectionHeader count={currentOrders.length} label="En cours" />
          </TabsContent>
          <TabsContent value="history">
            <SectionHeader count={historyOrders.length} label="Historique" />
          </TabsContent>
        </Tabs>

        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : selectedOrders.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {tab === "current"
              ? "Aucune commande en cours. Passez une nouvelle commande pour commencer."
              : "Aucun historique de commande pour le moment."}
          </div>
        ) : (
          <div className="space-y-4">
            {selectedOrders.map((order) => {
              const orderItems = items[order.id] ?? [];
              const rating = ratings[order.id];
              return (
                <div key={order.id} className="rounded-3xl border bg-card p-4 shadow-sm">
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
                      {isCurrentStatus(order.status) && order.status !== "pending" && (
                        <OrderCountdownBadge order={order} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/commande/$id"
                        params={{ id: order.id }}
                        className="press inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold"
                      >
                        Voir la commande
                      </Link>
                      <button
                        type="button"
                        onClick={() => addOrderToCart(order)}
                        className="press inline-flex h-11 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground"
                      >
                        Recommander
                      </button>
                    </div>
                  </div>

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
                        <button
                          type="button"
                          onClick={() => openRating(order.id)}
                          className="mt-3 inline-flex h-10 items-center rounded-full border px-3 text-sm font-semibold"
                        >
                          Modifier la note
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openRating(order.id)}
                        className="mt-2 inline-flex h-11 items-center gap-2 rounded-full border border-brand text-brand px-4 text-sm font-semibold"
                      >
                        <Star className="h-4 w-4" /> Évaluer cette commande
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {ratingOrderId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Évaluer la commande</h2>
                <p className="text-sm text-muted-foreground">Donnez une note pour améliorer BOX.</p>
              </div>
              <button
                type="button"
                onClick={closeRating}
                className="text-sm font-semibold text-muted-foreground"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRatingValue(value)}
                      className={`rounded-full p-2 transition ${
                        ratingValue >= value
                          ? "bg-[#E11D2E] text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Star className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>

              <label className="block text-sm font-semibold">Commentaire (optionnel)</label>
              <textarea
                value={ratingComment}
                onChange={(event) => setRatingComment(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border bg-input p-3 text-sm"
                placeholder="Ce que vous avez aimé ou ce qu'on peut améliorer..."
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeRating}
                  className="flex-1 rounded-full border px-4 py-3 text-sm font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => submitRating(ratingOrderId)}
                  disabled={savingRating}
                  className="flex-1 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  {savingRating ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
