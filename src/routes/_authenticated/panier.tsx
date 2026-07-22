import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { fmt } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, MapPin, ShoppingBag } from "lucide-react";

import type { CartOptionSelection } from "@/lib/cart-context";
import { deliveryDistanceKm, isWithinDeliveryZone, DELIVERY_RADIUS_KM } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/panier")({
  component: PanierPage,
});

function formatCartName(_itemId: string, name: string, _categoryName: string | undefined) {
  return name;
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
  const [profile, setProfile] = useState<{
    full_name: string;
    phone: string;
  } | null>(null);
  // Adresse de livraison réellement sélectionnée par le client : elle vit dans
  // la table `addresses` (celle marquée par défaut, sinon la plus récente), et
  // non plus dans les colonnes héritées `profiles.lat/lng/address`. C'est cette
  // adresse — et ses coordonnées — qui doit servir au contrôle de zone.
  const [deliveryAddress, setDeliveryAddress] = useState<{
    full_address: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [menuInfo, setMenuInfo] = useState<Record<string, { image?: string; categoryName?: string }>>({});

  useEffect(() => {
    const ids = Array.from(new Set(lines.map((l) => l.itemId))).filter(Boolean);
    if (ids.length === 0) {
      setMenuInfo({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("id, image_url, categories(name)")
        .in("id", ids);
      if (!data) return;
      const map: Record<string, { image?: string; categoryName?: string }> = {};
      for (const row of data as Array<{ id: string; image_url: string | null; categories: { name: string } | { name: string }[] | null }>) {
        const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
        map[row.id] = { image: row.image_url ?? undefined, categoryName: cat?.name };
      }
      setMenuInfo(map);
    })();
  }, [lines]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", data.user.id)
        .maybeSingle();
      const pp = (p ?? {}) as { full_name?: string | null; phone?: string | null };
      setProfile({
        full_name: pp.full_name ?? "",
        phone: pp.phone ?? "",
      });

      // Adresse par défaut (is_default) sinon la plus récente : même règle de
      // sélection que la page profil (pickPrimary).
      const { data: addrs } = await supabase
        .from("addresses" as never)
        .select("full_address, latitude, longitude, is_default, created_at")
        .eq("user_id", data.user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const rows = (addrs ?? []) as unknown as Array<{
        full_address: string | null;
        latitude: number | null;
        longitude: number | null;
      }>;
      const primary = rows[0];
      setDeliveryAddress(
        primary
          ? {
              full_address: primary.full_address ?? "",
              lat: primary.latitude ?? null,
              lng: primary.longitude ?? null,
            }
          : null,
      );
    });
  }, []);

  async function confirm() {
    // Sans profil complété ou sans adresse de livraison enregistrée, on
    // redirige vers l'écran de complétion (où l'adresse est ajoutée/choisie).
    if (!profile?.full_name || !deliveryAddress) {
      return navigate({ to: "/complete-profile", search: { redirect: "/panier" } });
    }
    if (lines.length === 0) return;
    // Coordonnées de l'adresse SÉLECTIONNÉE, recalculées au moment du clic.
    const coords = { lat: deliveryAddress.lat, lng: deliveryAddress.lng };
    const distanceKm = deliveryDistanceKm(coords);
    // Fail-closed : coordonnées manquantes/invalides => on bloque (on ne peut
    // pas garantir la zone), et on invite à re-choisir l'adresse sur la carte.
    if (distanceKm == null) {
      return toast.error(
        "Adresse de livraison sans localisation valide. Modifiez l'adresse et repositionnez le point sur la carte.",
      );
    }
    // Blocage zone de livraison : au-delà du rayon, on empêche l'envoi de la
    // commande avec un message clair (l'adresse reste enregistrable côté compte).
    if (distanceKm > DELIVERY_RADIUS_KM) {
      return toast.error(
        `Cette adresse est hors de notre zone de livraison (rayon ${DELIVERY_RADIUS_KM} km). Choisissez une adresse plus proche du restaurant.`,
      );
    }
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user!.id;
    const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const insertPayload = {
      user_id: uid,
      customer_name: profile.full_name,
      phone: profile.phone,
      total,
      expires_at: expires,
      address: deliveryAddress.full_address,
      lat: coords.lat,
      lng: coords.lng,
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

  // Contrôle de zone pour l'affichage (bouton désactivé + message). Recalculé
  // à chaque rendu à partir de l'adresse sélectionnée ; fail-closed.
  const hasAddress = !!deliveryAddress;
  const outOfZone = hasAddress && !isWithinDeliveryZone(deliveryAddress);
  // Bouton actif tant qu'on n'est pas en cours d'envoi ni hors zone. S'il
  // manque une adresse, le clic redirige vers l'écran d'ajout (cf. confirm()).
  const canSubmit = !submitting && !outOfZone;
  // Fond de carte du bloc livraison, basé sur les coordonnées de l'adresse
  // SÉLECTIONNÉE (table `addresses`), pas sur les colonnes profil héritées.
  const mapBg =
    deliveryAddress?.lat != null && deliveryAddress?.lng != null
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${deliveryAddress.lat},${deliveryAddress.lng}&zoom=15&size=600x300&maptype=mapnik&markers=${deliveryAddress.lat},${deliveryAddress.lng},red-pushpin`
      : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-black text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="press flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <ShoppingBag className="h-5 w-5 text-[#F5B800]" />
          <h1 className="text-lg font-black tracking-tight">Mon panier</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 pb-28">
        {lines.length === 0 ? (
          <div className="space-y-5">
            <div className="rounded-[28px] border border-black/5 bg-[#F1F2F4] p-10 text-center">
              <p className="text-sm text-black/60">Votre panier est vide.</p>
            </div>
            <Link
              to="/"
              className="press flex h-14 w-full items-center justify-center rounded-full bg-[#E11D2E] text-base font-black text-white shadow-lg transition-colors hover:bg-[#B22222]"
            >
              Voir le menu
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Items */}
            <div className="space-y-3">
              {lines.map((l) => {
                const info = menuInfo[l.itemId];
                const img = info?.image;
                const unit = l.unitPrice + (l.options ?? []).reduce((s, o) => s + o.price, 0);
                return (
                  <div
                    key={l.key}
                    className="group relative overflow-hidden rounded-[22px] border border-black/5 bg-white p-3 shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(225,29,46,0.15)] hover:border-[#E11D2E]/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-[#F1F2F4]">
                        {img ? (
                          <img
                            src={img}
                            alt={l.name}
                            className="h-full w-full object-contain p-1 transition-transform duration-500 group-hover:scale-110"
                            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15)) saturate(1.15)" }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-black text-black">
                              {formatCartName(l.itemId, l.name, info?.categoryName)}
                            </div>
                            {l.size && <div className="text-xs text-black/50">{l.size}</div>}
                            {l.options && l.options.length > 0 && (
                              <div className="mt-0.5 line-clamp-2 text-[11px] text-black/50">
                                {formatCartOptions(l.options)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => remove(l.key)}
                            className="press flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-black/5 text-black/60 transition-colors hover:bg-[#E11D2E] hover:text-white"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 rounded-full bg-black p-1">
                            <button
                              onClick={() => setQty(l.key, l.qty - 1)}
                              className="press flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-black text-white">{l.qty}</span>
                            <button
                              onClick={() => setQty(l.key, l.qty + 1)}
                              className="press flex h-7 w-7 items-center justify-center rounded-full bg-[#E11D2E] font-black text-white ring-2 ring-white transition-colors hover:bg-[#B22222]"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-base font-black text-[#E11D2E]">
                            {fmt(unit * l.qty)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <input
                        defaultValue={l.note ?? ""}
                        onBlur={(e) => setNote(l.key, e.target.value)}
                        placeholder="Note pour cet article (optionnel)"
                        className="h-9 w-full rounded-full border border-black/10 bg-[#F1F2F4] px-4 text-xs focus:border-[#E11D2E] focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Special instructions */}
            <div className="rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-black">
                <span className="inline-block h-2 w-2 rounded-full bg-[#F5B800]" />
                Instructions spéciales
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Ex : sans oignons, sonnez à l'interphone 3B…"
                rows={3}
                maxLength={500}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F1F2F4] p-3 text-sm focus:border-[#E11D2E] focus:outline-none"
              />
            </div>

            {/* Delivery address with map background */}
            <div className="group relative overflow-hidden rounded-[22px] border border-black/5 bg-black text-white shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
              {/* Map / grid background */}
              <div
                className="absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-75"
                style={{
                  backgroundImage: mapBg
                    ? `url(${mapBg})`
                    : "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                  backgroundSize: mapBg ? "cover" : "24px 24px",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/35 to-[#E11D2E]/30" />
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#F5B800]">
                      <MapPin className="h-3.5 w-3.5" />
                      Livraison
                    </div>
                    <div className="mt-2 font-black">{profile?.full_name || "—"}</div>
                    {profile?.phone && (
                      <div className="text-xs text-white/70">{profile.phone}</div>
                    )}
                    <div className="mt-1 text-sm text-white/90">
                      {deliveryAddress?.full_address || "Adresse manquante"}
                    </div>
                    {outOfZone && (
                      <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                        Adresse hors de notre zone de livraison (rayon {DELIVERY_RADIUS_KM} km).
                        Choisissez une adresse plus proche du restaurant.
                      </p>
                    )}
                  </div>
                  <Link
                    to="/complete-profile"
                    search={{ redirect: "/panier" }}
                    className="press flex h-9 flex-shrink-0 items-center rounded-full bg-white px-4 text-xs font-black text-black hover:bg-[#F5B800]"
                  >
                    Modifier
                  </Link>
                </div>
              </div>
            </div>

            {/* Total row — blends with background */}
            <div className="flex items-end justify-between px-2 pt-2">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-black/50">Total</div>
                <div className="mt-1 flex items-baseline gap-1.5 text-3xl font-black text-black">
                  {fmt(total)}
                  <span className="text-sm font-black text-black/60">TND</span>
                </div>
              </div>
              <div className="rounded-full bg-[#F5B800] px-3 py-1 text-[11px] font-black text-black">
                Paiement sur place
              </div>
            </div>

            {/* Action button — part of the page, not fixed */}
            <button
              disabled={!canSubmit}
              onClick={confirm}
              className="press h-14 w-full rounded-full bg-[#E11D2E] text-base font-black text-white shadow-lg transition-colors hover:bg-[#B22222] disabled:opacity-50"
            >
              {submitting
                ? "Envoi…"
                : outOfZone
                  ? "Adresse hors zone"
                  : `Confirmer la commande · ${fmt(total)} TND`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
