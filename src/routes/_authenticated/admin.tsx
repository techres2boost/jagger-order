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
  RotateCcw,
} from "lucide-react";
import { EnableNotifications } from "@/components/EnableNotifications";
import { toast } from "sonner";
import { computeEstimatedTimes } from "@/lib/order-timing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

type AdminOrderStatus =
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
  user_id?: string | null;
  customer_name: string;
  phone: string;
  total: number;
  status: AdminOrderStatus;
  expires_at: string;
  created_at: string;
  address?: string | null;
  city?: string | null;
  special_instructions?: string | null;
  distance_km?: number | null;
  assigned_livreur_id?: string | null;
  pending_assignment?: boolean | null;
  assignment_expires_at?: string | null;
}

// Statuts non-« pending » = onglet Historique (côté admin).
const ADMIN_HISTORY_STATUSES: AdminOrderStatus[] = [
  "accepted",
  "ready",
  "delivering",
  "delivered",
  "refused",
  "expired",
  "cancelled",
];

const ADMIN_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  ready: "Prête",
  delivering: "En livraison",
  delivered: "Livrée",
  refused: "Refusée",
  expired: "Expirée",
  cancelled: "Annulée",
};

type AdminFilterOptions = {
  clients: Array<{ user_id: string; customer_name: string }>;
  cities: string[];
  addresses: string[];
};
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
  // --- Filtres historique (Feature 1) : tous appliqués côté serveur ---
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | "all">("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [appliedAmount, setAppliedAmount] = useState<{ min: string; max: string }>({
    min: "",
    max: "",
  });
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [addressFilter, setAddressFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [historyRows, setHistoryRows] = useState<OrderRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<AdminFilterOptions>({
    clients: [],
    cities: [],
    addresses: [],
  });
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState<RefusalReason>("unavailable");
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

  // Débounce des montants pour ne pas requêter à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => setAppliedAmount({ min: minAmount, max: maxAmount }), 400);
    return () => clearTimeout(t);
  }, [minAmount, maxAmount]);

  // Options des filtres (clients/villes/adresses) via RPC admin, chargées une fois.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_order_filters");
      if (!error && data) setFilterOptions(data as AdminFilterOptions);
    })();
  }, []);

  // Historique filtré CÔTÉ SERVEUR (statut + montant + client + adresse + ville).
  // Se recharge quand un filtre change, ou quand `orders` change (Realtime/poll).
  useEffect(() => {
    if (tab !== "history" || isNestedAdminRoute) return;
    let cancelled = false;
    (async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (statusFilter === "all") query = query.neq("status", "pending");
      else query = query.eq("status", statusFilter);
      const min = parseFloat(appliedAmount.min);
      if (!Number.isNaN(min)) query = query.gte("total", min);
      const max = parseFloat(appliedAmount.max);
      if (!Number.isNaN(max)) query = query.lte("total", max);
      if (clientFilter !== "all") query = query.eq("user_id", clientFilter);
      if (addressFilter !== "all") query = query.eq("address", addressFilter);
      if (cityFilter !== "all") query = query.eq("city", cityFilter);
      const { data, error } = await query;
      if (!cancelled && !error) setHistoryRows((data as OrderRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    isNestedAdminRoute,
    statusFilter,
    appliedAmount,
    clientFilter,
    addressFilter,
    cityFilter,
    orders,
  ]);

  const filtersActive =
    statusFilter !== "all" ||
    appliedAmount.min !== "" ||
    appliedAmount.max !== "" ||
    clientFilter !== "all" ||
    addressFilter !== "all" ||
    cityFilter !== "all";

  function resetHistoryFilters() {
    setStatusFilter("all");
    setMinAmount("");
    setMaxAmount("");
    setClientFilter("all");
    setAddressFilter("all");
    setCityFilter("all");
  }

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

  // Feature 2 : marquer prête = passer le statut à `ready`. L'assignation d'un
  // livreur est ENSUITE automatique (worker serveur : proposition 2 min, timeout,
  // file d'attente). On déclenche une tentative immédiate via l'RPC admin ; le
  // cron couvre les timeouts et les reprises.
  async function markReady(id: string) {
    const readyAt = new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({ status: "ready", ready_at: readyAt } as never)
      .eq("id", id)
      .eq("status", "accepted");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Commande prête — recherche d'un livreur…");
    const { error: rpcError } = await supabase.rpc("admin_process_assignments");
    if (rpcError) {
      // Non bloquant : le cron réessaiera de toute façon.
      console.warn("admin_process_assignments:", rpcError.message);
    }
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
  // L'historique provient d'une requête filtrée côté serveur (historyRows),
  // pas d'un filtrage en mémoire, pour rester performant si la table grossit.
  const list = tab === "pending" ? pending : historyRows;

  // Feature 2 : commandes prêtes sans livreur (file d'attente) + noms des livreurs.
  const queuedOrders = orders.filter((o) => o.pending_assignment);
  const livreurNameById = Object.fromEntries(livreurs.map((l) => [l.id, l.nom]));

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
          {/* Feature 2 : alerte fiable (fallback du push) — commandes prêtes sans
              livreur disponible, en file d'attente jusqu'à ce qu'un livreur se libère. */}
          {queuedOrders.length > 0 && (
            <div className="rounded-2xl border-2 border-warning/50 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-warning">
                <Bell className="h-4 w-4" />
                {queuedOrders.length} commande{queuedOrders.length > 1 ? "s" : ""} en attente
                d&apos;un livreur
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Aucun livreur disponible pour le moment. L&apos;assignation reprendra
                automatiquement dès qu&apos;un livreur se libère.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {queuedOrders.map((o) => (
                  <li key={o.id} className="font-mono">
                    #{o.id.slice(0, 8)} — {o.customer_name} — {fmt(Number(o.total))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === "history" && (
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Statut</label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as AdminOrderStatus | "all")}
                >
                  <SelectTrigger className="h-10 w-40">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {ADMIN_HISTORY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ADMIN_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Client</label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-10 w-44">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    {filterOptions.clients.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>
                        {c.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Ville</label>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="h-10 w-40">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les villes</SelectItem>
                    {filterOptions.cities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Adresse</label>
                <Select value={addressFilter} onValueChange={setAddressFilter}>
                  <SelectTrigger className="h-10 w-56">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les adresses</SelectItem>
                    {filterOptions.addresses.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
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
                  className="h-10 w-24"
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
                  className="h-10 w-24"
                />
              </div>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetHistoryFilters}
                  className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold"
                >
                  <RotateCcw className="h-4 w-4" /> Réinitialiser
                </button>
              )}
            </div>
          )}
          {list.length === 0 && (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              {tab === "pending"
                ? "Aucune commande en attente."
                : filtersActive
                  ? "Aucune commande ne correspond à ces filtres."
                  : "Aucune commande traitée."}
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
                    {/* Feature 2 : état d'assignation du livreur (info admin). */}
                    {o.status === "ready" && o.pending_assignment && (
                      <div className="mt-1 text-[10px] font-bold text-warning">
                        En attente d&apos;un livreur
                      </div>
                    )}
                    {o.status === "ready" && !o.pending_assignment && o.assigned_livreur_id && (
                      <div className="mt-1 text-[10px] font-semibold text-muted-foreground">
                        Proposée à {livreurNameById[o.assigned_livreur_id] ?? "livreur"}
                      </div>
                    )}
                    {o.status === "delivering" && o.assigned_livreur_id && (
                      <div className="mt-1 text-[10px] font-semibold text-muted-foreground">
                        Livreur : {livreurNameById[o.assigned_livreur_id] ?? "—"}
                      </div>
                    )}
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
                      onClick={() => markReady(o.id)}
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
