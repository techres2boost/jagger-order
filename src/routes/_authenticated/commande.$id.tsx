import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart-context";
import { BoxLogo } from "@/components/BoxLogo";
import { fmt } from "@/lib/format";
import { CheckCircle2, Clock, PackageCheck, Truck, PartyPopper, XCircle, Ban } from "lucide-react";
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
}

interface OrderItemRow {
  id: string;
  name: string;
  qty: number;
  size: string | null;
  unit_price: number;
  note: string | null;
}

type ProgressStatus = "pending" | "accepted" | "ready" | "delivering" | "delivered";

const STEPS: { key: ProgressStatus; label: string; Icon: typeof Clock }[] = [
  { key: "pending", label: "Reçue", Icon: Clock },
  { key: "accepted", label: "En préparation", Icon: CheckCircle2 },
  { key: "ready", label: "Prête", Icon: PackageCheck },
  { key: "delivering", label: "En livraison", Icon: Truck },
  { key: "delivered", label: "Livrée", Icon: PartyPopper },
];

const STATUS_TEXT: Record<ProgressStatus, string> = {
  pending: "Votre commande a été reçue et est en attente de confirmation.",
  accepted: "Votre commande est en cours de préparation.",
  ready: "Votre commande est prête et va être prise en charge pour la livraison.",
  delivering: "Votre commande est en route !",
  delivered: "Votre commande a été livrée. Bon appétit !",
};

const REFUSAL_LABEL: Record<"unavailable" | "busy", string> = {
  unavailable: "Plat non disponible",
  busy: "Restaurant occupé",
};

function ProgressRing({ stepIndex }: { stepIndex: number }) {
  const size = 220;
  const center = size / 2;
  const r = 90;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * r;
  const gapDeg = 6;
  const segDeg = 72 - gapDeg;
  const segLen = (segDeg / 360) * circumference;
  const dashArray = `${segLen} ${circumference - segLen}`;
  const current = STEPS[Math.max(0, stepIndex)];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {STEPS.map((step, i) => {
          const filled = i <= stepIndex;
          const startAngle = i * 72 - 90 + gapDeg / 2;
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
              transform={`rotate(${startAngle} ${center} ${center})`}
              style={{ stroke: filled ? "var(--brand)" : "var(--muted)" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <current.Icon className="h-9 w-9" style={{ color: "var(--brand)" }} />
        <span className="text-sm font-bold">{current.label}</span>
      </div>
    </div>
  );
}

function OrderStatusPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [now, setNow] = useState(Date.now());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expirationEnvoyee = useRef(false);

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
      .select("id, name, qty, size, unit_price, note")
      .eq("order_id", id)
      .then(({ data }) => {
        if (mounted && data) setItems(data as OrderItemRow[]);
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

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Stop le tick uniquement sur un statut terminal ; on garde le décompte vivant
  // pendant accepted/ready/delivering pour l'arrivée estimée.
  useEffect(() => {
    const terminal =
      order != null &&
      (order.status === "delivered" ||
        order.status === "refused" ||
        order.status === "expired" ||
        order.status === "cancelled");
    if (terminal && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, [order?.status]);

  // Auto-expire côté client — verrou useRef pour n'envoyer qu'une seule requête
  useEffect(() => {
    if (
      order?.status === "pending" &&
      new Date(order.expires_at).getTime() < now &&
      !expirationEnvoyee.current
    ) {
      expirationEnvoyee.current = true;
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      supabase.rpc("expire_stale_orders");
    }
  }, [order?.status, order?.expires_at, now]);

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  function recommander() {
    if (items.length === 0) {
      navigate({ to: "/" });
      return;
    }
    items.forEach((item) => {
      add({
        itemId: `order-${order!.id}-${item.id}`,
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

  const itemsLabel = items.map((it) => `${it.qty}× ${it.name}`).join(", ");

  // ─── Écrans d'erreur (hors timeline de progression) ────────────────────
  if (order.status === "refused" || order.status === "expired" || order.status === "cancelled") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <BoxLogo size={56} showWordmark={false} />
        <div className="mt-6 w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm">
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
  // On décompte sur l'heure d'arrivée cible figée (prépa + trajet), calculée une
  // seule fois côté DB. Repli sur estimated_delivery_at pour les commandes
  // acceptées avant la mise en place de arrival_at.
  const arrivalTarget = order.arrival_at ?? order.estimated_delivery_at;
  const minutesRemaining = arrivalTarget
    ? Math.ceil((new Date(arrivalTarget).getTime() - now) / 60000)
    : null;
  const arrivalTime = arrivalTarget
    ? new Date(arrivalTarget).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <BoxLogo size={56} showWordmark={false} />

      <div className="mt-6 w-full max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm">
        {itemsLabel && (
          <p className="mb-4 text-sm font-semibold text-muted-foreground">{itemsLabel}</p>
        )}

        <ProgressRing stepIndex={stepIndex} />

        <p className="mt-4 text-sm text-muted-foreground">
          {STATUS_TEXT[order.status as ProgressStatus]}
        </p>

        {order.status !== "delivered" && minutesRemaining != null && arrivalTime && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="text-3xl font-black text-brand tabular-nums">
              {minutesRemaining > 0 ? `${minutesRemaining} min` : "Bientôt là"}
            </div>
            <div className="text-sm text-muted-foreground">Arrivée prévue à {arrivalTime}</div>
          </div>
        )}

        {order.status === "pending" && (
          <div className="mt-4 text-4xl font-black text-brand tabular-nums">
            {mm}:{ss}
          </div>
        )}

        <div className="mt-6 border-t pt-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-black text-brand">{fmt(Number(order.total))}</div>
        </div>

        {order.status === "pending" && remaining > 0 ? (
          <button
            onClick={() => setConfirmCancel(true)}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border-2 border-destructive px-6 font-bold text-destructive"
          >
            <Ban className="h-4 w-4" /> Annuler la commande
          </button>
        ) : order.status === "delivered" ? (
          <Link
            to="/"
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
                  if (tickRef.current) {
                    clearInterval(tickRef.current);
                    tickRef.current = null;
                  }
                  setConfirmCancel(false);
                  toast.success("Commande annulée");
                  navigate({ to: "/" });
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
