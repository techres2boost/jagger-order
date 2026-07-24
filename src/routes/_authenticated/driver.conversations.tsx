import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BoxLogo } from "@/components/BoxLogo";
import { OrderChat } from "@/components/OrderChat";
import { DriverNavbar } from "@/components/DriverNavbar";
import { ArrowLeft, MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/conversations")({
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
  component: DriverConversationsPage,
});

// Une conversation existe pour chaque commande dont le chat est actif, c.-à-d.
// en cours de livraison ('delivering' ; cf. RLS can_access_order_chat).
interface Conversation {
  id: string;
  customerName: string;
  lastContent: string | null;
  lastAt: string | null;
}

function DriverConversationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let ordersChannel: ReturnType<typeof supabase.channel> | null = null;
    let messagesChannel: ReturnType<typeof supabase.channel> | null = null;

    async function load(livreurId: string) {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, customer_name")
        .eq("assigned_livreur_id", livreurId)
        .eq("status", "delivering");
      const orders = (ordersData as Array<{ id: string; customer_name: string }>) ?? [];
      const ids = orders.map((o) => o.id);

      // Dernier message par commande (le plus récent d'abord, on garde le 1er vu).
      const lastByOrder: Record<string, { content: string; created_at: string }> = {};
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from("order_messages" as never)
          .select("order_id, content, created_at")
          .in("order_id", ids)
          .order("created_at", { ascending: false });
        for (const m of (msgs as Array<{
          order_id: string;
          content: string;
          created_at: string;
        }> | null) ?? []) {
          if (!lastByOrder[m.order_id]) {
            lastByOrder[m.order_id] = { content: m.content, created_at: m.created_at };
          }
        }
      }

      if (!mounted) return;
      setConversations(
        orders.map((o) => ({
          id: o.id,
          customerName: o.customer_name || "Client",
          lastContent: lastByOrder[o.id]?.content ?? null,
          lastAt: lastByOrder[o.id]?.created_at ?? null,
        })),
      );
      setLoading(false);
    }

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!mounted || !u.user) return;
      setUserId(u.user.id);
      const { data: livreur } = await supabase
        .from("livreurs")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!mounted || !livreur) {
        setLoading(false);
        return;
      }
      await load(livreur.id);

      // Rafraîchit la liste quand la composition des livraisons change
      // (commande livrée → conversation retirée) ou à l'arrivée d'un message.
      ordersChannel = supabase
        .channel(`driver-convos-orders-${livreur.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `assigned_livreur_id=eq.${livreur.id}`,
          },
          () => load(livreur.id),
        )
        .subscribe();
      messagesChannel = supabase
        .channel(`driver-convos-messages-${livreur.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "order_messages" },
          () => load(livreur.id),
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (ordersChannel) supabase.removeChannel(ordersChannel);
      if (messagesChannel) supabase.removeChannel(messagesChannel);
    };
  }, []);

  // Une seule conversation → chat ouvert directement (pas de liste intermédiaire).
  const single = conversations.length === 1 ? conversations[0] : null;
  const activeId = selectedId ?? single?.id ?? null;
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const canGoBack = conversations.length > 1 && selectedId !== null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-black/40 hero-gradient px-4 py-3 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {canGoBack ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
              aria-label="Retour aux conversations"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <BoxLogo size={36} showWordmark={false} />
          )}
          <h1 className="text-lg font-black">
            {activeConversation ? activeConversation.customerName : "Conversations"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            <MessagesSquare className="mb-2 h-8 w-8 text-muted-foreground/60" />
            Aucune conversation active.
          </div>
        ) : activeConversation && userId ? (
          <>
            <div className="rounded-2xl border bg-card px-4 py-2 text-xs text-muted-foreground">
              Commande #{activeConversation.id.slice(0, 8)}
            </div>
            <OrderChat orderId={activeConversation.id} currentUserId={userId} />
          </>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-brand/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black">{c.customerName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        #{c.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.lastContent ?? "Aucun message pour l'instant"}
                    </div>
                  </div>
                  {c.lastAt && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(c.lastAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <DriverNavbar />
    </div>
  );
}
