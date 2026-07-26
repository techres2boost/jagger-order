"use client";

// Fonctionnalité 2 — Popup d'évaluation de la DERNIÈRE commande livrée
// (satisfaction / qualité des plats). Monté sur la page d'accueil (MenuPage).
//
// Règles :
//  - Au montage, on récupère la dernière commande `delivered` du client
//    (created_at desc, limit 1) et, si aucune ligne order_ratings n'existe déjà
//    pour cette commande (peu importe dismissed), on propose le popup.
//  - S'affiche AU PLUS une fois par ouverture d'app (garde module-level), et
//    seulement pour LA dernière commande — jamais pour les précédentes.
//  - Overlay dismissible, ne bloque pas l'accès à la page.
//  - UI dupliquée à l'identique du popup d'avis existant (mêmes styles / classes)
//    — ne modifie pas ReviewPopup.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";

// Garde de niveau module : une seule tentative d'affichage par ouverture d'app
// (survit aux remontages / navigations, se réinitialise au rechargement).
let attemptedThisSession = false;

export function LastOrderReviewPopup() {
  const [uid, setUid] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (attemptedThisSession) return;
    attemptedThisSession = true;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      // Dernière commande livrée du client.
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !order) return;
      // Déjà évaluée OU déjà ignorée (une ligne existe) => on n'affiche pas.
      const { data: existing } = await supabase
        .from("order_ratings")
        .select("order_id")
        .eq("order_id", order.id)
        .maybeSingle();
      if (cancelled || existing) return;
      setUid(userId);
      setOrderId(order.id);
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible || !orderId) return null;

  function close() {
    setVisible(false);
    setSaving(false);
  }

  async function submit() {
    if (ratingValue < 1 || ratingValue > 5) {
      toast.error("Choisissez une note entre 1 et 5 étoiles.");
      return;
    }
    if (!uid || !orderId) return;
    setSaving(true);
    const { error } = await supabase.from("order_ratings").upsert(
      {
        order_id: orderId,
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
    close();
  }

  // "Plus tard" = ne plus jamais demander : marqueur durable dismissed = true.
  async function dismiss() {
    if (uid && orderId) {
      await supabase
        .from("order_ratings")
        .upsert({ order_id: orderId, user_id: uid, rating: null, dismissed: true } as never, {
          onConflict: "order_id",
        });
    }
    close();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Évaluer votre commande</h2>
            <p className="text-sm text-muted-foreground">
              Commande #{orderId.slice(0, 8)} — comment était votre repas ?
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
