import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart-context";
import { BoxLogo } from "@/components/BoxLogo";
import { DriverCard } from "@/components/DriverCard";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useOrderCountdown } from "@/hooks/use-order-countdown";
import { fmt } from "@/lib/format";
import { XCircle, Ban, MapPin, Clock, CheckCircle2, Truck, PartyPopper } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/commande/$id")({
  component: OrderStatusPage,
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
  total: number;
  customer_name: string;
  expires_at: string;
  refusal_reason?: "unavailable" | "busy" | null;
  estimated_delivery_at: string | null;
  arrival_at: string | null;
  assigned_livreur_id: string | null;
}

interface OrderItemRow {
  id: string;
  name: string;
  qty: number;
  size: string | null;
  unit_price: number;
  note: string | null;
  // Lien vers l'article du menu (null pour les commandes antérieures au correctif) :
  // requis pour « Recommander », car la création de commande recalcule les prix
  // côté serveur à partir de l'id menu.
  menu_item_id: string | null;
}

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending: "Votre commande a été reçue et est en attente de confirmation.",
  accepted: "Votre commande est en cours de préparation.",
  ready: "Votre commande est en cours de préparation.",
  delivering: "Votre commande est en route !",
  delivered: "Votre commande a été livrée. Bon appétit !",
  refused: "Votre commande a été refusée.",
  expired: "Votre commande n'a pas été confirmée à temps.",
  cancelled: "Votre commande a été annulée.",
};

// Stepper client à 4 étapes : "pret" est fusionné visuellement avec
// "en_preparation" (statut réel "ready" affiché comme "accepted").
const CLIENT_STEPS = [
  { key: "pending", label: "Reçue", Icon: Clock },
  { key: "accepted", label: "En préparation", Icon: CheckCircle2 },
  { key: "delivering", label: "En livraison", Icon: Truck },
  { key: "delivered", label: "Livrée", Icon: PartyPopper },
] as const;

type ClientProgressStatus = (typeof CLIENT_STEPS)[number]["key"];

function visualStatus(status: OrderStatus): ClientProgressStatus {
  if (status === "ready") return "accepted";
  if (status === "pending" || status === "accepted" || status === "delivering" || status === "delivered") {
    return status;
  }
  return "pending";
}

function ClientProgressRing({ stepIndex }: { stepIndex: number }) {
  const size = 220;
  const r = 90;
  const strokeWidth = 14;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;
  const gapDeg = 6;
  const segDeg = 360 / CLIENT_STEPS.length - gapDeg;
  const segLen = (segDeg / 360) * circumference;
  const dashArray = `${segLen} ${circumference}`;
  const current = CLIENT_STEPS[Math.max(0, stepIndex)];

  const gradientId = "box-client-progress-ring";
  const stepAngle = 360 / CLIENT_STEPS.length;
  const segmentTransform = (i: number) =>
    `rotate(${i * stepAngle - 90 + gapDeg / 2} ${center} ${center})`;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--primary)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent-warm)" }} />
          </linearGradient>
        </defs>
        {CLIENT_STEPS.map((step, i) => {
          const filled = i < stepIndex;
          return (
            <circle
              key={step.key}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dashArray}
              transform={segmentTransform(i)}
              style={{ stroke: filled ? `url(#${gradientId})` : "var(--border)" }}
            />
          );
        })}
        {stepIndex >= 0 && (
          <circle
            key={stepIndex}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            transform={segmentTransform(stepIndex)}
            className="ring-active"
            style={{ stroke: `url(#${gradientId})`, "--seg-len": segLen } as CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span key={current.key} className="icon-swap flex flex-col items-center gap-2">
          <current.Icon className="h-9 w-9" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-bold">{current.label}</span>
        </span>
      </div>
    </div>
  );
}

function ClientStepsRow({ stepIndex }: { stepIndex: number }) {
  const last = CLIENT_STEPS.length - 1;
  const filledWidth = last > 0 ? (Math.max(0, stepIndex) / last) * 75 : 0;

  return (
    <div className="relative mt-6">
      <div
        className="absolute left-[12.5%] right-[12.5%] top-[18px] h-0.5 -translate-y-1/2"
        style={{ background: "var(--border)" }}
      />
      <div
        className="absolute left-[12.5%] top-[18px] h-0.5 -translate-y-1/2 transition-[width] duration-500 ease-out"
        style={{ background: "var(--primary)", width: `${filledWidth}%` }}
      />
      <div className="relative flex justify-between">
        {CLIENT_STEPS.map((step, i) => {
          const reached = i <= stepIndex;
          const active = i === stepIndex;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${active ? "icon-swap" : ""}`}
                style={{
                  borderColor: reached ? "var(--primary)" : "var(--border)",
                  background: reached ? "var(--primary)" : "var(--card)",
                  color: reached ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
              >
                <step.Icon className="h-4 w-4" />
              </div>
              <span
                className="text-[10px] font-semibold leading-tight"
                style={{ color: reached ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const REFUSAL_LABEL: Record<"unavailable" | "busy", string> = {
  unavailable: "Plat non disponible",
  busy: "Restaurant occupé",
};

function OrderStatusPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [livreur, setLivreur] = useState<{ nom: string } | null>(null);
  const expirationEnvoyee = useRef(false);

  // Décompte temps réel mutualisé (interval + cleanup + repli + "Bientôt là").
  const { now, minutesRemaining, arrivalTime, label } = useOrderCountdown(order);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (mounted && data) setOrder(data as OrderRow);
      });
    supabase
      .from("order_items")
      .select("id, name, qty, size, unit_price, note, menu_item_id")
      .eq("order_id", id)
      .then(({ data }) => {
        if (mounted && data) setItems(data as unknown as OrderItemRow[]);
      });
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          setOrder(payload.new as OrderRow);
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Auto-expire côté client — verrou useRef pour n'envoyer qu'une seule requête
  useEffect(() => {
    if (
      order?.status === "pending" &&
      new Date(order.expires_at).getTime() < now &&
      !expirationEnvoyee.current
    ) {
      expirationEnvoyee.current = true;
      supabase.rpc("expire_stale_orders");
    }
  }, [order?.status, order?.expires_at, now]);

  // Récupération (lecture seule) du livreur assigné pour la carte livreur. Effet
  // additif, indépendant du canal realtime : quand `assigned_livreur_id` change
  // (assignation reçue via l'UPDATE realtime ci-dessus), on recharge la fiche.
  // Passe par la RPC `get_order_livreur` (SECURITY DEFINER) : les policies RLS de
  // `livreurs` n'autorisent en lecture que l'admin et le livreur lui-même, donc un
  // client ne peut PAS lire la table directement — la RPC renvoie juste le nom au
  // propriétaire de la commande. (rpc non typée dans les types générés → cast.)
  useEffect(() => {
    const livreurId = order?.assigned_livreur_id ?? null;
    if (!livreurId) {
      setLivreur(null);
      return;
    }
    let active = true;
    (supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: unknown }> })
      .rpc("get_order_livreur", { p_order_id: id })
      .then(({ data }) => {
        const row = (data as { id: string; nom: string }[] | null)?.[0] ?? null;
        if (active) setLivreur(row ? { nom: row.nom } : null);
      });
    return () => {
      active = false;
    };
  }, [order?.assigned_livreur_id, id]);

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  function recommander() {
    if (items.length === 0) {
      navigate({ to: "/app" });
      return;
    }
    // La création de commande recalcule les prix serveur à partir de l'id menu :
    // on ne peut réajouter que les articles encore reliés au menu (menu_item_id).
    // Les éventuels suppléments sont à re-sélectionner (repartir du prix de base).
    const reorderable = items.filter((it) => it.menu_item_id);
    if (reorderable.length === 0) {
      toast.error("Ces articles ne sont plus disponibles au rachat.");
      navigate({ to: "/app" });
      return;
    }
    reorderable.forEach((item) => {
      add({
        itemId: item.menu_item_id as string,
        name: item.name,
        size: item.size ?? undefined,
        unitPrice: Number(item.unit_price),
        qty: item.qty,
        note: item.note ?? undefined,
      });
    });
    if (reorderable.length < items.length) {
      toast.warning("Certains articles indisponibles ont été retirés du panier.");
    } else {
      toast.success("Commande ajoutée au panier.");
    }
    navigate({ to: "/panier" });
  }

  const itemsLabel = items.map((it) => `${it.qty}× ${it.name}`).join(", ");

  // ─── Écrans d'erreur (hors timeline de progression) ────────────────────
  if (order.status === "refused" || order.status === "expired" || order.status === "cancelled") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <BoxLogo size={56} showWordmark={false} />
        <div className="mt-6 w-full max-w-md rounded-[28px] border border-border bg-card p-6 text-center shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              order.status === "cancelled" ? "bg-muted" : "bg-destructive/20"
            }`}
          >
            {order.status === "cancelled" ? (
              <Ban className="h-8 w-8 text-muted-foreground" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" />
            )}
          </div>
          <h1 className="mt-4 text-2xl font-black">
            {order.status === "refused"
              ? "Commande refusée"
              : order.status === "expired"
                ? "Délai dépassé"
                : "Commande annulée"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {order.status === "refused"
              ? order.refusal_reason
                ? REFUSAL_LABEL[order.refusal_reason]
                : "Votre commande a été refusée."
              : order.status === "expired"
                ? "Votre commande n'a pas été confirmée à temps."
                : "Votre commande a été annulée."}
          </p>

          <div className="mt-6 border-t pt-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-black text-brand">{fmt(Number(order.total))}</div>
          </div>

          <button
            onClick={recommander}
            className="mt-6 inline-block h-11 rounded-full bg-brand px-6 pt-3 font-bold text-brand-foreground"
          >
            Recommander
          </button>
        </div>
      </div>
    );
  }

  // ─── Timeline de progression (5 étapes, livraison uniquement) ───────────
  const stepIndex = STEPS.findIndex((s) => s.key === order.status);
  const remaining = Math.max(0, Math.floor((new Date(order.expires_at).getTime() - now) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <BoxLogo size={56} showWordmark={false} />

      <div className="mt-6 w-full max-w-md rounded-[28px] border border-border bg-card p-6 text-center shadow-[0_20px_40px_-24px_rgba(46,30,23,0.35)]">
        {itemsLabel && !livreur && (
          <p className="mb-4 text-sm font-semibold text-muted-foreground">{itemsLabel}</p>
        )}

        <OrderProgressRing stepIndex={stepIndex} />

        <OrderStepsRow stepIndex={stepIndex} />

        <p className="mt-4 text-sm text-muted-foreground">
          {STATUS_TEXT[order.status as ProgressStatus]}
        </p>

        {order.status !== "delivered" && minutesRemaining != null && arrivalTime && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <AnimatedNumber
              value={label ?? ""}
              className="text-3xl font-black text-brand tabular-nums"
            />
            <div className="text-sm text-muted-foreground">Arrivée prévue à {arrivalTime}</div>
          </div>
        )}

        {order.status === "pending" && (
          <AnimatedNumber
            value={`${mm}:${ss}`}
            className="mt-4 text-4xl font-black text-brand tabular-nums"
          />
        )}

        {livreur && (
          <DriverCard
            orderId={order.id}
            nom={livreur.nom}
            subtitle={
              order.status === "delivering"
                ? "En route vers vous"
                : order.status === "ready"
                  ? "Prise en charge en cours"
                  : order.status === "delivered"
                    ? "Commande livrée"
                    : "Livreur assigné"
            }
            itemsLabel={itemsLabel}
            total={Number(order.total)}
          />
        )}

        {/* "Suivre sur la carte" : dès qu'un livreur est assigné (hors commande
            déjà livrée), renvoie vers l'écran carte OSM + chat. */}
        {livreur && order.status !== "delivered" && (
          <Link
            to="/orders/$orderId/tracking"
            params={{ orderId: order.id }}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 font-bold text-brand-foreground"
          >
            <MapPin className="h-4 w-4" /> Suivre sur la carte
          </Link>
        )}

        {/* Total autonome uniquement sans carte livreur (sinon le prix est déjà
            affiché dans la carte). */}
        {!livreur && (
          <div className="mt-6 border-t pt-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-black text-brand">{fmt(Number(order.total))}</div>
          </div>
        )}

        {order.status === "pending" && remaining > 0 ? (
          <button
            onClick={() => setConfirmCancel(true)}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border-2 border-destructive px-6 font-bold text-destructive"
          >
            <Ban className="h-4 w-4" /> Annuler la commande
          </button>
        ) : order.status === "delivered" ? (
          <Link
            to="/app"
            className="mt-6 inline-block h-11 rounded-full bg-brand px-6 pt-3 font-bold text-brand-foreground"
          >
            Retour au menu
          </Link>
        ) : null}
      </div>

      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !cancelling && setConfirmCancel(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black">Annuler la commande ?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Êtes-vous sûr d'annuler cette commande ? Cette action est définitive.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                disabled={cancelling}
                onClick={() => setConfirmCancel(false)}
                className="flex-1 rounded-full border-2 px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                Non
              </button>
              <button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  const { error } = await supabase
                    .from("orders")
                    .update({ status: "cancelled" } as never)
                    .eq("id", id)
                    .eq("status", "pending");
                  setCancelling(false);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  setConfirmCancel(false);
                  toast.success("Commande annulée");
                  navigate({ to: "/app" });
                }}
                className="flex-1 rounded-full bg-destructive px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {cancelling ? "…" : "Oui, annuler"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
