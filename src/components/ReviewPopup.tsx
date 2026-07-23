"use client";

// Feature 4 (règle révisée) — Popup d'avis automatique après livraison.
// Monté globalement dans le layout authentifié.
//
// Règles :
//  - PAS de rattrapage : le popup ne se déclenche QUE lorsqu'une commande du
//    client passe à `delivered` EN TEMPS RÉEL pendant que l'app est ouverte
//    (transition old.status != 'delivered' -> new.status = 'delivered'). Les
//    commandes déjà livrées avant l'ouverture ne sont jamais rattrapées.
//  - "Plus tard" = définitif : on enregistre un marqueur durable
//    (order_ratings.dismissed = true) et le popup ne réapparaît plus jamais pour
//    cette commande.
//  - Un avis existant (noté OU ignoré) empêche tout ré-affichage (contrôle sur
//    l'existence d'une ligne order_ratings pour l'order_id).
//  - On n'affiche pas le popup pendant un checkout en cours (pages panier /
//    complétion de profil) : il reste en attente et s'affiche au retour sur un
//    écran neutre, avec un léger délai.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";

// Écrans de composition/validation de commande : on n'interrompt pas.
const CHECKOUT_PREFIXES = ["/panier", "/complete-profile"];

export function ReviewPopup() {
  const location = useLocation();
  const onCheckout = CHECKOUT_PREFIXES.some((p) => location.pathname.startsWith(p));

  const [uid, setUid] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Abonnement Realtime : réagit UNIQUEMENT à la transition vers `delivered`.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      setUid(userId);
      channel = supabase
        .channel(`review-popup-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
          async (payload) => {
            const newRow = payload.new as { id?: string; status?: string };
            const oldRow = payload.old as { status?: string };
            // Seulement la vraie transition -> delivered (orders a REPLICA IDENTITY
            // FULL, donc old.status est disponible).
            if (newRow?.status !== "delivered" || oldRow?.status === "delivered") return;
            const orderId = newRow.id;
            if (!orderId || seenRef.current.has(orderId)) return;
            seenRef.current.add(orderId);
            // Déjà noté OU déjà ignoré (marqueur durable) => on n'affiche pas.
            const { data: existing } = await supabase
              .from("order_ratings")
              .select("order_id")
              .eq("order_id", orderId)
              .maybeSingle();
            if (existing) return;
            setPending((q) => (q.includes(orderId) ? q : [...q, orderId]));
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Promotion d'une commande en attente vers l'affichage : pas pendant un
  // checkout, et après un court délai pour éviter d'apparaître en plein geste.
  useEffect(() => {
    if (activeOrderId || pending.length === 0 || onCheckout) return;
    const t = setTimeout(() => {
      setActiveOrderId(pending[0]);
      setRatingValue(0);
      setComment("");
    }, 3000);
    return () => clearTimeout(t);
  }, [pending, activeOrderId, onCheckout]);

  if (!activeOrderId) return null;

  function finishActive() {
    const id = activeOrderId;
    setPending((q) => q.filter((x) => x !== id));
    setActiveOrderId(null);
    setSaving(false);
  }

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
        dismissed: false,
      } as never,
      { onConflict: "order_id" },
    );
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    toast.success("Merci pour votre note !");
    finishActive();
  }

  // "Plus tard" = ne plus jamais demander : marqueur durable dismissed = true.
  async function dismiss() {
    if (uid && activeOrderId) {
      await supabase.from("order_ratings").upsert(
        { order_id: activeOrderId, user_id: uid, rating: null, dismissed: true } as never,
        { onConflict: "order_id" },
      );
    }
    finishActive();
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
