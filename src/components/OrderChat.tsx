"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";

// Chat client <-> livreur d'une commande en cours de livraison.
// - Insert dans order_messages (order_id, sender_id, content).
// - Realtime : postgres_changes INSERT filtré par order_id.
// - Nom de l'expéditeur via jointure profiles.full_name ; alignement de la bulle
//   déterminé en comparant sender_id à auth.uid() (le rôle n'est jamais stocké).
// - La notification push vers l'autre participant est déclenchée côté base
//   (trigger trg_order_message_notify), pas ici.

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

type MessageRow = ChatMessage & {
  profiles?: { full_name: string | null } | null;
};

// Table hors types générés (comme addresses/push_subscriptions) : requêtes non typées.
const chatTable = () => supabase.from("order_messages" as never);

export function OrderChat({ orderId, currentUserId }: { orderId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cache des noms d'expéditeur (sender_id -> full_name), alimenté à la volée.
  const namesRef = useRef<Record<string, string>>({});
  const [, forceRender] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rememberName = useCallback((id: string, name: string | null | undefined) => {
    const clean = (name ?? "").trim();
    if (clean && namesRef.current[id] !== clean) {
      namesRef.current[id] = clean;
      forceRender((n) => n + 1);
    }
  }, []);

  // Résout le nom d'un expéditeur absent du cache via profiles (RLS ouvert aux
  // deux participants pendant la livraison).
  const resolveName = useCallback(
    async (senderId: string) => {
      if (namesRef.current[senderId]) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", senderId)
        .maybeSingle();
      rememberName(senderId, (data as { full_name: string | null } | null)?.full_name);
    },
    [rememberName],
  );

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  }, []);

  // Chargement initial + abonnement Realtime aux nouveaux messages.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await chatTable()
        .select("id, sender_id, content, created_at, profiles(full_name)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      const rows = (data as MessageRow[] | null) ?? [];
      rows.forEach((r) => rememberName(r.sender_id, r.profiles?.full_name));
      setMessages(
        rows.map((r) => ({
          id: r.id,
          sender_id: r.sender_id,
          content: r.content,
          created_at: r.created_at,
        })),
      );
      setLoading(false);
    })();

    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          appendMessage(row);
          if (!namesRef.current[row.sender_id]) resolveName(row.sender_id);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, appendMessage, rememberName, resolveName]);

  // Auto-scroll vers le bas à chaque nouveau message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    // On ne fait pas d'ajout optimiste : le message revient via Realtime (même
    // chemin des deux côtés), et appendMessage déduplique par id.
    const { error } = await chatTable().insert({
      order_id: orderId,
      sender_id: currentUserId,
      content,
    } as never);
    setSending(false);
    if (error) return;
    setDraft("");
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-brand px-4 py-2 text-sm font-black uppercase tracking-wide text-brand-foreground">
        Discussion livraison
      </div>

      <div ref={scrollRef} className="max-h-72 min-h-[8rem] space-y-2 overflow-y-auto p-3">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun message pour l'instant. Écrivez pour démarrer la discussion.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const name = namesRef.current[m.sender_id] || (mine ? "Vous" : "Interlocuteur");
            const time = new Date(m.created_at).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-brand text-brand-foreground"
                      : "rounded-bl-sm bg-secondary text-foreground"
                  }`}
                >
                  {!mine && <div className="mb-0.5 text-[11px] font-bold opacity-80">{name}</div>}
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  <div
                    className={`mt-0.5 text-right text-[10px] ${
                      mine ? "text-brand-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {time}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Votre message…"
          maxLength={500}
          className="h-10 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Envoyer"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
