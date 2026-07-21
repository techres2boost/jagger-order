import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BoxLogo } from "@/components/BoxLogo";
import { fmt } from "@/lib/format";
import {
  CheckCircle2,
  XCircle,
  LogOut,
  ArrowLeft,
  BarChart3,
  Bell,
  BellOff,
  PackageCheck,
  List,
  ListChecks,
  Bike,
} from "lucide-react";
import { EnableNotifications } from "@/components/EnableNotifications";
import { toast } from "sonner";
import { computeEstimatedTimes } from "@/lib/order-timing";

type RefusalReason = "unavailable" | "busy";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

interface OrderRow {
  id: string;
  customer_name: string;
  phone: string;
  total: number;
  status:
    | "pending"
    | "accepted"
    | "ready"
    | "delivering"
    | "delivered"
    | "refused"
    | "expired"
    | "cancelled";
  expires_at: string;
  created_at: string;
  address?: string | null;
  special_instructions?: string | null;
  distance_km?: number | null;
  assigned_livreur_id?: string | null;
}
interface LivreurRow {
  id: string;
  nom: string;
  is_active: boolean;
}
interface ItemRow {
  id: string;
  order_id: string;
  name: string;
  size: string | null;
  qty: number;
  unit_price: number;
  note: string | null;
}
interface ItemOptionRow {
  option_name: string;
  option_price: number;
}

function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isNestedAdminRoute =
    location.pathname.startsWith("/admin/") && location.pathname !== "/admin";
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, ItemRow[]>>({});
  const [itemOptions, setItemOptions] = useState<Record<string, ItemOptionRow[]>>({});
  const [livreurs, setLivreurs] = useState<LivreurRow[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState<RefusalReason>("unavailable");
  const [readyOrderId, setReadyOrderId] = useState<string | null>(null);
  const [selectedLivreurId, setSelectedLivreurId] = useState<string | null>(null);
  const [assigningLivreur, setAssigningLivreur] = useState(false);
  const [muted, setMuted] = useState(false);
  const prevPendingCountRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadAll() {
    await supabase.rpc("expire_stale_orders");
    const { data: livreursData } = await supabase
      .from("livreurs")
      .select("id, nom, is_active")
      .eq("is_active", true)
      .order("nom", { ascending: true });
    if (livreursData) setLivreurs(livreursData as LivreurRow[]);

    const { data: os } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (os) {
      setOrders(os as OrderRow[]);
      const ids = os.map((o) => o.id);
      if (ids.length) {
        const { data: its } = await supabase.from("order_items").select("*").in("order_id", ids);
        if (its) {
          const map: Record<string, ItemRow[]> = {};
          (its as ItemRow[]).forEach((it) => {
            (map[it.order_id] ||= []).push(it);
          });
          setItems(map);

          const itemIds = (its as ItemRow[]).map((it) => it.id);
          if (itemIds.length) {
            const { data: opts } = await supabase
              .from("order_item_options")
              .select("order_item_id, option_name, option_price")
              .in("order_item_id", itemIds);
            if (opts) {
              const optMap: Record<string, ItemOptionRow[]> = {};
              opts.forEach((o) => {
                (optMap[o.order_item_id] ||= []).push({
                  option_name: o.option_name,
                  option_price: Number(o.option_price),
                });
              });
              setItemOptions(optMap);
            }
          } else {
            setItemOptions({});
          }
        }
      }
    }
  }

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadAll())
      .subscribe();
    const poll = setInterval(loadAll, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pending count derived below via filter, but we compute here too for effects.
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  // Unmute automatically when a new pending order arrives.
  useEffect(() => {
    if (pendingCount > prevPendingCountRef.current) {
      setMuted(false);
    }
    prevPendingCountRef.current = pendingCount;
  }, [pendingCount]);

  // Looping notification sound while there is at least one pending order and not muted.
  useEffect(() => {
    function stop() {
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    }
    if (pendingCount === 0 || muted) {
      stop();
      return;
    }
    function playBeep() {
      try {
        if (typeof window === "undefined") return;
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const makeTone = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, now + start);
          gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + dur + 0.02);
        };
        makeTone(880, 0, 0.18);
        makeTone(1175, 0.22, 0.22);
      } catch {
        /* ignore */
      }
    }
    playBeep();
    beepIntervalRef.current = setInterval(playBeep, 1500);
    return stop;
  }, [pendingCount, muted]);

  // Best-effort: unlock AudioContext on first user gesture (browsers require it).
  useEffect(() => {
    function unlock() {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  async function acceptOrder(id: string) {
    const order = orders.find((o) => o.id === id);
    const acceptedAt = new Date();
    const { estimatedReadyAt, estimatedDeliveryAt } = computeEstimatedTimes(
      acceptedAt,
      order?.distance_km ?? null,
    );
    const { error } = await supabase
      .from("orders")
      .update({
        status: "accepted",
        accepted_at: acceptedAt.toISOString(),
        estimated_ready_at: estimatedReadyAt.toISOString(),
        estimated_delivery_at: estimatedDeliveryAt.toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending");
    if (error) toast.error(error.message);
    else toast.success("Commande acceptée");
  }

  function openReadyModal(id: string) {
    setSelectedLivreurId(null);
    setReadyOrderId(id);
  }

  async function confirmAssignLivreur() {
    if (!readyOrderId || !selectedLivreurId) return;
    setAssigningLivreur(true);
    const readyAt = new Date().toISOString();
    const { error: readyError } = await supabase
      .from("orders")
      .update({
        status: "ready",
        ready_at: readyAt,
        assigned_livreur_id: selectedLivreurId,
      } as never)
      .eq("id", readyOrderId)
      .eq("status", "accepted");
    if (readyError) {
      setAssigningLivreur(false);
      toast.error(readyError.message);
      return;
    }
    // La transition ready -> delivering est immédiate une fois le livreur assigné.
    const deliveringAt = new Date().toISOString();
    const { error: deliveringError } = await supabase
      .from("orders")
      .update({ status: "delivering", delivering_at: deliveringAt } as never)
      .eq("id", readyOrderId)
      .eq("status", "ready");
    setAssigningLivreur(false);
    if (deliveringError) {
      toast.error(deliveringError.message);
      return;
    }
    toast.success("Commande en livraison");
    setReadyOrderId(null);
    setSelectedLivreurId(null);
  }

  async function markDelivered(id: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() } as never)
      .eq("id", id)
      .eq("status", "delivering");
    if (error) toast.error(error.message);
    else toast.success("Commande livrée");
  }

  async function confirmRefuse() {
    if (!refusingId) return;
    const id = refusingId;
    const reason = refuseReason;
    // Tente d'écrire aussi le motif ; si la colonne n'existe pas encore, retente sans.
    let { error } = await supabase
      .from("orders")
      .update({ status: "refused", refusal_reason: reason } as never)
      .eq("id", id)
      .eq("status", "pending");
    if (error && /refusal_reason|column/i.test(error.message)) {
      const retry = await supabase
        .from("orders")
        .update({ status: "refused" })
        .eq("id", id)
        .eq("status", "pending");
      error = retry.error;
      if (!error) toast.warning("Motif non enregistré (colonne manquante en base).");
    }
    if (error) toast.error(error.message);
    else toast.success("Commande refusée");
    setRefusingId(null);
  }

  const pending = orders.filter((o) => o.status === "pending");
  const history = orders.filter((o) => o.status !== "pending");
  const list = tab === "pending" ? pending : history;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <BoxLogo size={30} showWordmark={false} />
            <h1 className="text-lg font-black">Admin BOX</h1>
          </div>
          <div className="flex items-center gap-2">
            <EnableNotifications role="admin" />
            {pendingCount > 0 && (
              <button
                onClick={() => setMuted((m) => !m)}
                title={muted ? "Réactiver le son" : "Couper le son"}
                aria-label={muted ? "Réactiver le son" : "Couper le son"}
                className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold ${muted ? "border-muted text-muted-foreground" : "border-brand text-brand"}`}
              >
                {muted ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4 animate-pulse" />
                )}
                <span className="hidden sm:inline">{muted ? "Son coupé" : "Son actif"}</span>
              </button>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Déconnecté");
              }}
              className="flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold"
            >
              <LogOut className="h-4 w-4" /> Sortir
            </button>
          </div>
        </div>
        <div className="hide-scrollbar mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4 pb-3">
          <button
            onClick={() => {
              setTab("pending");
              navigate({ to: "/admin" });
            }}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === "pending" && !isNestedAdminRoute ? "bg-brand text-brand-foreground" : "bg-secondary"}`}
          >
            En attente ({pending.length})
          </button>
          <button
            onClick={() => {
              setTab("history");
              navigate({ to: "/admin" });
            }}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === "history" && !isNestedAdminRoute ? "bg-brand text-brand-foreground" : "bg-secondary"}`}
          >
            Historique
          </button>
          <Link
            to="/admin/menu"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/80"
          >
            <List className="h-4 w-4" /> Gestion du menu
          </Link>
          <Link
            to="/admin/options"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/80"
          >
            <ListChecks className="h-4 w-4" /> Options
          </Link>
          <Link
            to="/admin/livreurs"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/80"
          >
            <Bike className="h-4 w-4" /> Livreurs
          </Link>
          <Link
            to="/dashboard"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/80"
          >
            <BarChart3 className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      {isNestedAdminRoute ? (
        <Outlet />
      ) : (
        <main className="mx-auto max-w-4xl space-y-3 px-4 py-4">
          {list.length === 0 && (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Aucune commande {tab === "pending" ? "en attente" : "traitée"}.
            </div>
          )}
          {list.map((o) => {
            const remaining = Math.max(
              0,
              Math.floor((new Date(o.expires_at).getTime() - now) / 1000),
            );
            const mm = Math.floor(remaining / 60);
            const ss = String(remaining % 60).padStart(2, "0");
            return (
              <div key={o.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                    {o.address && (
                      <div className="mt-1 text-xs text-muted-foreground">📍 {o.address}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-brand">{fmt(Number(o.total))}</div>
                    <StatusBadge status={o.status} />
                  </div>
                </div>

                <ul className="mt-3 space-y-1 border-t pt-3 text-sm">
                  {(items[o.id] ?? []).map((it) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span>
                        <span className="font-semibold">{it.qty}×</span> {it.name}
                        {it.size ? (
                          <span className="text-muted-foreground"> · {it.size}</span>
                        ) : null}
                        {it.note ? (
                          <span className="block text-xs italic text-muted-foreground">
                            « {it.note} »
                          </span>
                        ) : null}
                        {(itemOptions[it.id] ?? []).length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {(itemOptions[it.id] ?? [])
                              .map((o) =>
                                o.option_price > 0
                                  ? `${o.option_name} +${fmt(o.option_price)}`
                                  : o.option_name,
                              )
                              .join(", ")}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap font-medium">
                        {fmt(Number(it.unit_price) * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>

                {o.special_instructions && (
                  <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
                    <div className="text-xs font-black uppercase tracking-wide text-brand">
                      Instructions
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{o.special_instructions}</div>
                  </div>
                )}

                {o.status === "pending" && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="text-sm font-black text-brand tabular-nums">
                      {mm}:{ss}
                    </div>
                    <button
                      onClick={() => {
                        setRefuseReason("unavailable");
                        setRefusingId(o.id);
                      }}
                      className="ml-auto flex h-10 items-center gap-1 rounded-full border-2 border-destructive px-4 text-sm font-bold text-destructive"
                    >
                      <XCircle className="h-4 w-4" /> Refuser
                    </button>
                    <button
                      onClick={() => acceptOrder(o.id)}
                      className="flex h-10 items-center gap-1 rounded-full bg-success px-4 text-sm font-bold text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Accepter
                    </button>
                  </div>
                )}
                {o.status === "accepted" && (
                  <div className="mt-4 flex items-center justify-end">
                    <button
                      onClick={() => openReadyModal(o.id)}
                      className="flex h-10 items-center gap-1 rounded-full bg-blue-600 px-4 text-sm font-bold text-white"
                    >
                      <PackageCheck className="h-4 w-4" /> Marquer comme prête
                    </button>
                  </div>
                )}
                {o.status === "delivering" && (
                  <div className="mt-4 flex items-center justify-end">
                    <button
                      onClick={() => markDelivered(o.id)}
                      className="flex h-10 items-center gap-1 rounded-full bg-success px-4 text-sm font-bold text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Marquer comme livrée
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </main>
      )}

      {refusingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRefusingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black">Motif du refus</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sélectionnez la raison pour laquelle vous refusez cette commande.
            </p>
            <div className="mt-4 space-y-2">
              {(["unavailable", "busy"] as RefusalReason[]).map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${refuseReason === r ? "border-brand bg-brand/5" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={refuseReason === r}
                    onChange={() => setRefuseReason(r)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="text-sm font-semibold">
                    {r === "unavailable" ? "Plat non disponible" : "Restaurant occupé"}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setRefusingId(null)}
                className="flex-1 rounded-full border-2 px-4 py-2 text-sm font-bold"
              >
                Annuler
              </button>
              <button
                onClick={confirmRefuse}
                className="flex-1 rounded-full bg-destructive px-4 py-2 text-sm font-bold text-white"
              >
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}

      {readyOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !assigningLivreur && setReadyOrderId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black">Assigner un livreur</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choisissez le livreur qui prendra en charge cette commande.
            </p>

            {livreurs.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Aucun livreur actif. Créez-en un depuis la section{" "}
                <Link to="/admin/livreurs" className="font-semibold text-brand underline">
                  Livreurs
                </Link>
                .
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {livreurs.map((l) => {
                  const busy = orders.some(
                    (o) => o.status === "delivering" && o.assigned_livreur_id === l.id,
                  );
                  return (
                    <label
                      key={l.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 ${selectedLivreurId === l.id ? "border-brand bg-brand/5" : "border-border"}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="livreur"
                          checked={selectedLivreurId === l.id}
                          onChange={() => setSelectedLivreurId(l.id)}
                          className="h-4 w-4 accent-brand"
                        />
                        <span className="text-sm font-semibold">{l.nom}</span>
                      </span>
                      {busy && (
                        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">
                          Occupé
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                disabled={assigningLivreur}
                onClick={() => setReadyOrderId(null)}
                className="flex-1 rounded-full border-2 px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                disabled={!selectedLivreurId || assigningLivreur}
                onClick={confirmAssignLivreur}
                className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50"
              >
                {assigningLivreur ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderRow["status"] }) {
  const map: Record<OrderRow["status"], { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-warning/20 text-warning" },
    accepted: { label: "Acceptée", cls: "bg-success/20 text-success" },
    ready: { label: "Prête", cls: "bg-blue-500/20 text-blue-600" },
    delivering: { label: "En livraison", cls: "bg-blue-500/20 text-blue-600" },
    delivered: { label: "Livrée", cls: "bg-success/20 text-success" },
    refused: { label: "Refusée", cls: "bg-destructive/20 text-destructive" },
    expired: { label: "Expirée", cls: "bg-muted text-muted-foreground" },
    cancelled: { label: "Annulée par le client", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status];
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}
