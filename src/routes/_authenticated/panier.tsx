import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { fmt } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, MapPin } from "lucide-react";
import { MENU, CATEGORIES } from "@/data/menu";
import type { CartOptionSelection } from "@/lib/cart-context";
import { haversineDistanceKm, RESTAURANT_LOCATION, DELIVERY_RADIUS_KM } from "@/lib/geo";
import { z } from "zod";

const panierSearchSchema = z.object({
  autoSubmit: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/panier")({
  validateSearch: panierSearchSchema,
  component: PanierPage,
});

function formatCartName(itemId: string, name: string) {
  const item = MENU.find((m) => m.id === itemId);
  if (!item) return name;
  if (item.category === "formules" || item.category === "entrees") return name;
  const label = CATEGORIES.find((c) => c.id === item.category)?.label ?? item.category;
  return `${label} ${name}`;
}

function formatCartOptions(options: CartOptionSelection[] | undefined) {
  if (!options || options.length === 0) return "";
  return options
    .map((o) => (o.type === "supplement" ? `Supplément ${o.name} +${fmt(o.price)}` : o.name))
    .join(", ");
}

function PanierPage() {
  const { lines, setQty, remove, setNote, total, clear } = useCart();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/panier" });
  const [profile, setProfile] = useState<{
    full_name: string;
    phone: string;
    address: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone, address, lat, lng")
        .eq("id", data.user.id)
        .maybeSingle();
      const pp = (p ?? {}) as {
        full_name?: string | null;
        phone?: string | null;
        address?: string | null;
        lat?: number | null;
        lng?: number | null;
      };
      setProfile({
        full_name: pp.full_name ?? "",
        phone: pp.phone ?? "",
        address: pp.address ?? "",
        lat: pp.lat ?? null,
        lng: pp.lng ?? null,
      });
    });
  }, []);

  useEffect(() => {
    if (autoSubmittedRef.current) return;
    if (search.autoSubmit !== 1) return;
    if (!profile?.full_name || !profile.address) return;
    if (lines.length === 0) return;
    if (submitting) return;
    autoSubmittedRef.current = true;
    navigate({ to: "/panier", search: {}, replace: true });
    void confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.autoSubmit, profile, lines.length]);

  async function confirm() {
    if (!profile?.full_name || !profile.address) {
      return navigate({ to: "/complete-profile", search: { redirect: "/panier" } });
    }
    if (lines.length === 0) return;
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user!.id;
    const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const distanceKm =
      profile.lat != null && profile.lng != null
        ? haversineDistanceKm(RESTAURANT_LOCATION, { lat: profile.lat, lng: profile.lng })
        : null;
    // Blocage zone de livraison : au-delà du rayon, on empêche l'envoi de la
    // commande avec un message clair (l'adresse reste enregistrable côté compte).
    if (distanceKm != null && distanceKm > DELIVERY_RADIUS_KM) {
      setSubmitting(false);
      return toast.error(
        `Cette adresse est hors de notre zone de livraison (rayon ${DELIVERY_RADIUS_KM} km). Choisissez une adresse plus proche du restaurant.`,
      );
    }
    const insertPayload = {
      user_id: uid,
      customer_name: profile.full_name,
      phone: profile.phone,
      total,
      expires_at: expires,
      address: profile.address,
      lat: profile.lat,
      lng: profile.lng,
      special_instructions: specialInstructions.trim() || null,
      distance_km: distanceKm,
    };
    const { data: order, error } = await supabase
      .from("orders")
      .insert(insertPayload as never)
      .select()
      .single();
    if (error || !order) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Erreur");
    }

    const items = lines.map((l) => ({
      order_id: order.id,
      name: l.name,
      size: l.size ?? null,
      qty: l.qty,
      unit_price: l.unitPrice + (l.options ?? []).reduce((s, o) => s + o.price, 0),
      note: l.note ?? null,
    }));
    const { data: createdItems, error: e2 } = await supabase
      .from("order_items")
      .insert(items)
      .select("id");
    if (e2 || !createdItems) {
      setSubmitting(false);
      return toast.error(e2?.message ?? "Erreur");
    }

    const optionRows = lines.flatMap((l, index) => {
      const orderItemId = createdItems[index]?.id;
      if (!orderItemId) return [];
      return (l.options ?? []).map((o) => ({
        order_item_id: orderItemId,
        option_item_id: o.optionItemId,
        option_name: o.name,
        option_price: o.price,
      }));
    });

    if (optionRows.length > 0) {
      const { error: e3 } = await supabase.from("order_item_options").insert(optionRows);
      if (e3) {
        setSubmitting(false);
        return toast.error(e3.message);
      }
    }

    clear();
    navigate({ to: "/commande/$id", params: { id: order.id } });
  }

  return (
    <div className="min-h-screen bg-background pb-44">
      <header className="sticky top-0 z-20 border-b border-black/40 hero-gradient text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-black">Mon panier</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {lines.length === 0 ? (
          <div className="tint-red rounded-[28px] border border-transparent p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
            <Link
              to="/"
              className="press mt-4 inline-block h-11 rounded-full brand-gradient px-6 pt-3 font-bold text-white shadow-lg"
            >
              Voir le menu
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((l) => (
              <div
                key={l.key}
                className="card-hover rounded-[20px] border border-transparent bg-card p-3 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-bold">{formatCartName(l.itemId, l.name)}</div>
                    {l.size && <div className="text-xs text-muted-foreground">{l.size}</div>}
                    {l.options && l.options.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {formatCartOptions(l.options)}
                      </div>
                    )}
                    <div className="mt-1 text-sm font-black text-[color:var(--gold)]">
                      {fmt(l.unitPrice + (l.options ?? []).reduce((s, o) => s + o.price, 0))}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(l.key)}
                    className="press flex h-9 w-9 items-center justify-center rounded-full brand-gradient text-white shadow-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border px-1 py-1">
                    <button
                      onClick={() => setQty(l.key, l.qty - 1)}
                      className="press h-8 w-8 rounded-full bg-secondary font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.key, l.qty + 1)}
                      className="press h-8 w-8 rounded-full brand-gradient font-bold text-white"
                    >
                      +
                    </button>
                  </div>
                  <input
                    defaultValue={l.note ?? ""}
                    onBlur={(e) => setNote(l.key, e.target.value)}
                    placeholder="Note (optionnel)"
                    className="h-9 flex-1 rounded-full border bg-input px-3 text-xs"
                  />
                </div>
              </div>
            ))}

            <div className="mt-6 space-y-3 rounded-[20px] border border-transparent bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wide text-[color:var(--gold)]">
                    Livraison
                  </div>
                  <div className="mt-1 font-bold">{profile?.full_name || "—"}</div>
                  {profile?.phone && (
                    <div className="text-xs text-muted-foreground">{profile.phone}</div>
                  )}
                  <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                    <span className="break-words">{profile?.address || "Adresse manquante"}</span>
                  </div>
                </div>
                <Link
                  to="/complete-profile"
                  search={{ redirect: "/panier" }}
                  className="press flex h-9 items-center rounded-full border border-brand/40 px-3 text-xs font-semibold text-brand hover:bg-secondary"
                >
                  Modifier
                </Link>
              </div>
            </div>

            <div className="rounded-[20px] border border-transparent bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
              <label className="text-xs font-black uppercase tracking-wide text-[color:var(--gold)]">
                Instructions spéciales / Remarques
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Ex : sans oignons, sonnez à l'interphone 3B…"
                rows={3}
                maxLength={500}
                className="mt-2 w-full rounded-xl border bg-input p-3 text-sm"
              />
            </div>
          </div>
        )}
      </main>

      {lines.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-black text-[color:var(--gold)]">{fmt(total)}</div>
            </div>
            <button
              disabled={submitting}
              onClick={confirm}
              className="press ml-auto h-12 flex-1 rounded-full brand-gradient font-bold text-white shadow-lg disabled:opacity-50"
            >
              {submitting ? "Envoi…" : "Confirmer la commande"}
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-muted-foreground">
            Paiement en personne au restaurant. Aucun paiement en ligne.
          </p>
        </div>
      )}
    </div>
  );
}
