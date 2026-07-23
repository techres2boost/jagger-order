"use client";

// Feature 4 — Popup d'avis automatique après livraison.
// Monté globalement dans le layout authentifié : dès qu'une commande du client
// passe à `delivered` (via Realtime) et n'a pas encore d'avis, une invitation à
// noter apparaît. Si le client n'était pas là au changement de statut, le popup
// s'affiche à la prochaine ouverture (calcul des commandes livrées sans avis au
// montage). Une commande déjà notée ne redéclenche jamais le popup (contrôle sur
// l'existence d'un avis lié à order_id). Chaque commande livrée = son propre popup.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";

export function ReviewPopup() {
  const [uid, setUid] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Recalcule les commandes livrées de CE client sans avis (et non écartées).
  const refresh = useCallback(async (userId: string) => {
    const { data: delivered } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "delivered");
    const ids = ((delivered as { id: string }[] | null) ?? []).map((o) => o.id);
    if (ids.length === 0) {
      setQueue([]);
      return;
    }
    const { data: rated } = await supabase
      .from("order_ratings")
      .select("order_id")
      .in("order_id", ids);
    const ratedSet = new Set(((rated as { order_id: string }[] | null) ?? []).map((r) => r.order_id));
    setQueue(ids.filter((id) => !ratedSet.has(id) && !dismissedRef.current.has(id)));
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      setUid(userId);
      await refresh(userId);
      channel = supabase
        .channel(`review-popup-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
          () => refresh(userId),
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Sélectionne la prochaine commande à noter dès qu'aucun popup n'est ouvert.
  useEffect(() => {
    if (activeOrderId) return;
    const next = queue.find((id) => !dismissedRef.current.has(id));
    if (next) {
      setActiveOrderId(next);
      setRatingValue(0);
      setComment("");
    }
  }, [queue, activeOrderId]);

  if (!activeOrderId) return null;

  async function submit() {
    if (ratingValue < 1 || ratingValue > 5) {
      toast.error("Choisissez une note entre 1 et 5 étoiles.");
      return;
    }
    if (!uid || !activeOrderId) return;
    setSaving(true);
    const { error } = await supabase.from("order_ratings").upsert(
      {
        order_id: activeOrderId,
        user_id: uid,
        rating: ratingValue,
        comment: comment.trim() || null,
      } as never,
      { onConflict: "order_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Merci pour votre note !");
    const done = activeOrderId;
    setQueue((q) => q.filter((id) => id !== done));
    setActiveOrderId(null);
  }

  // Fermer sans noter : écarté pour la session (réapparaîtra à la prochaine
  // ouverture tant qu'aucun avis n'est enregistré).
  function dismiss() {
    if (activeOrderId) dismissedRef.current.add(activeOrderId);
    const done = activeOrderId;
    setQueue((q) => q.filter((id) => id !== done));
    setActiveOrderId(null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Évaluer votre commande</h2>
            <p className="text-sm text-muted-foreground">
              Commande #{activeOrderId.slice(0, 8)} livrée — donnez votre avis.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-sm font-semibold text-muted-foreground"
          >
            Plus tard
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
                  aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
                  className={`rounded-full p-2 transition ${
                    ratingValue >= value
                      ? "bg-[#E11D2E] text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ratingValue >= value ? (
                    <Star className="h-5 w-5" />
                  ) : (
                    <StarOff className="h-5 w-5" />
                  )}
                </button>
              );
            })}
          </div>

          <label className="block text-sm font-semibold">Commentaire (optionnel)</label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border bg-input p-3 text-sm"
            placeholder="Ce que vous avez aimé ou ce qu'on peut améliorer..."
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-full border px-4 py-3 text-sm font-semibold"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="flex-1 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Envoyer mon avis"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
