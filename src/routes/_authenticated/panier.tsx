import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCart, WELCOME_PROMO_CODE, promoDiscountAmount } from "@/lib/cart-context";
import { fmt } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2, MapPin, ShoppingBag, BadgePercent } from "lucide-react";

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
  const { lines, setQty, remove, setNote, total, clear, promoCode } = useCart();
  const navigate = useNavigate();
  // `total` du contexte = sous-total des articles (aucun frais de livraison
  // n'est ajouté au total dans cette app : le calcul Haversine/`geo` ne sert
  // qu'au contrôle de zone). La réduction promo s'applique donc au sous-total.
  const subtotal = total;

  // Éligibilité de l'offre de bienvenue (réservée à la première commande).
  //  null  = en cours de vérification / non pertinent (pas de code promo)
  //  true  = première commande → réduction applicable
  //  false = l'utilisateur a déjà une commande → « Offre déjà utilisée »
  const [welcomeEligible, setWelcomeEligible] = useState<boolean | null>(null);
  const hasWelcomePromo = promoCode === WELCOME_PROMO_CODE;
  const [profile, setProfile] = useState<{
    full_name: string;
    phone: string;
  } | null>(null);
  // Adresse de livraison réellement sélectionnée par le client : elle vit dans
  // la table `addresses` (celle marquée par défaut, sinon la plus récente), et
  // non plus dans les colonnes héritées `profiles.lat/lng/address`. C'est cette
  // adresse — et ses coordonnées — qui doit servir au contrôle de zone.
  const [deliveryAddress, setDeliveryAddress] = useState<{
    id: string | null;
    full_address: string;
    lat: number | null;
    lng: number | null;
    city: string | null;
  } | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [menuInfo, setMenuInfo] = useState<
    Record<string, { image?: string; categoryName?: string }>
  >({});

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
      for (const row of data as Array<{
        id: string;
        image_url: string | null;
        categories: { name: string } | { name: string }[] | null;
      }>) {
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
        .select("id, full_address, latitude, longitude, is_default, created_at, city")
        .eq("user_id", data.user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const rows = (addrs ?? []) as unknown as Array<{
        id: string;
        full_address: string | null;
        latitude: number | null;
        longitude: number | null;
        city: string | null;
      }>;
      const primary = rows[0];
      setDeliveryAddress(
        primary
          ? {
              id: primary.id,
              full_address: primary.full_address ?? "",
              lat: primary.latitude ?? null,
              lng: primary.longitude ?? null,
              city: primary.city ?? null,
            }
          : null,
      );
    });
  }, []);

  // Règle « première commande » : on vérifie si l'utilisateur connecté a déjà
  // une commande réellement passée (on exclut les statuts qui n'aboutissent pas
  // à un achat : expirée / annulée / refusée). Le checkout étant authentifié,
  // un utilisateur est toujours présent ici. Sans code promo, aucune requête.
  useEffect(() => {
    if (!hasWelcomePromo) {
      setWelcomeEligible(null);
      return;
    }
    let cancelled = false;
    setWelcomeEligible(null);
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        // Invité (cas théorique ici) : on applique l'offre par défaut.
        if (!cancelled) setWelcomeEligible(true);
        return;
      }
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", uid)
        .in("status", ["pending", "accepted", "ready", "delivering", "delivered"])
        .limit(1);
      if (cancelled) return;
      // Fail-open discret : en cas d'erreur de lecture, on ne bloque pas l'offre.
      if (error) {
        setWelcomeEligible(true);
        return;
      }
      setWelcomeEligible((data ?? []).length === 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Réduction effectivement appliquée : uniquement si le code est WELCOME10 ET
  // que l'utilisateur y est éligible (première commande). Sinon 0.
  const discount = welcomeEligible === true ? promoDiscountAmount(subtotal, promoCode) : 0;
  const finalTotal = Math.round((subtotal - discount) * 1000) / 1000;
  // Message discret quand l'offre est présente mais déjà consommée.
  const welcomeAlreadyUsed = hasWelcomePromo && welcomeEligible === false;

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
    if (!deliveryAddress.id) {
      return toast.error(
        "Adresse de livraison non enregistrée. Modifiez l'adresse et enregistrez-la avant de commander.",
      );
    }
    setSubmitting(true);
    // Création serveur (RPC SECURITY DEFINER) : le total et tous les prix sont
    // RECALCULÉS en base à partir du menu (jamais la valeur du client). On
    // envoie uniquement les références (article, format, options), la quantité,
    // la note, l'adresse choisie et le code promo. La RPC insère commande +
    // articles + options de façon atomique et renvoie l'id de la commande.
    const payloadItems = lines.map((l) => ({
      item_id: l.itemId,
      size: l.size ?? null,
      qty: l.qty,
      note: l.note ?? null,
      options: (l.options ?? []).map((o) => o.optionItemId),
    }));
    // Cast `as any` : la RPC n'est pas encore dans les types générés (stale),
    // même motif que `admin_process_assignments` ailleurs dans le projet.
    const { data: newOrderId, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: string | null; error: { message: string } | null }>;
      }
    ).rpc("create_order_secure", {
      p_address_id: deliveryAddress.id,
      p_special_instructions: specialInstructions.trim() || null,
      p_promo_code: promoCode,
      p_items: payloadItems,
    });
    if (error || !newOrderId) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Erreur lors de la création de la commande");
    }

    clear();
    navigate({ to: "/commande/$id", params: { id: newOrderId as string } });
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-secondary-warm text-brand-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/app"
            className="press flex h-10 w-10 items-center justify-center rounded-full bg-brand-foreground/10 hover:bg-brand-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <ShoppingBag className="h-5 w-5 text-accent-warm" />
          <h1 className="text-lg font-black tracking-tight">Mon panier</h1>
          {lines.length > 0 && (
            <span className="ml-auto text-xs font-medium text-brand-foreground/60">
              {lines.length} article{lines.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 pb-28">
        {lines.length === 0 ? (
          <div className="space-y-5">
            <div className="rounded-[28px] border border-border bg-surface-2 p-10 text-center">
              <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
            </div>
            <Link
              to="/app"
              className="press flex h-14 w-full items-center justify-center rounded-full bg-brand text-base font-black text-brand-foreground shadow-lg transition-[filter] hover:brightness-95"
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
                    className="group relative overflow-hidden rounded-[22px] border border-border bg-card p-3 shadow-[0_1px_6px_rgba(46,30,23,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(181,36,0,0.15)] hover:border-[color:var(--primary)]/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-surface-2">
                        {img ? (
                          <img
                            src={img}
                            alt={l.name}
                            className="h-full w-full object-contain p-1 transition-transform duration-500 group-hover:scale-110"
                            style={{
                              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15)) saturate(1.15)",
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">
                            🍽️
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-black text-foreground">
                              {formatCartName(l.itemId, l.name, info?.categoryName)}
                            </div>
                            {l.size && (
                              <div className="text-xs text-muted-foreground">{l.size}</div>
                            )}
                            {l.options && l.options.length > 0 && (
                              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                {formatCartOptions(l.options)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => remove(l.key)}
                            className="press flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 rounded-full bg-secondary-warm p-1">
                            <button
                              onClick={() => setQty(l.key, l.qty - 1)}
                              className="press flex h-7 w-7 items-center justify-center rounded-full text-brand-foreground transition-colors hover:bg-brand-foreground/10"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-black text-brand-foreground">
                              {l.qty}
                            </span>
                            <button
                              onClick={() => setQty(l.key, l.qty + 1)}
                              className="press flex h-7 w-7 items-center justify-center rounded-full bg-brand font-black text-brand-foreground ring-2 ring-[color:var(--card)] transition-[filter] hover:brightness-95"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-base font-black text-brand">{fmt(unit * l.qty)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <input
                        defaultValue={l.note ?? ""}
                        onBlur={(e) => setNote(l.key, e.target.value)}
                        placeholder="Note pour cet article (optionnel)"
                        className="h-9 w-full rounded-full border border-border bg-surface-2 px-4 text-xs focus:border-[color:var(--primary)] focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Special instructions */}
            <div className="rounded-[22px] border border-border bg-card p-4 shadow-[0_1px_6px_rgba(46,30,23,0.06)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(46,30,23,0.08)]">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-accent-warm" />
                Instructions spéciales
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Ex : sans oignons, sonnez à l'interphone 3B…"
                rows={3}
                maxLength={500}
                className="mt-2 w-full rounded-2xl border border-border bg-surface-2 p-3 text-sm focus:border-[color:var(--primary)] focus:outline-none"
              />
            </div>

            {/* Delivery address with map background */}
            <div className="warm-dots group relative overflow-hidden rounded-[22px] border border-border bg-secondary-warm text-brand-foreground shadow-[0_1px_6px_rgba(46,30,23,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(46,30,23,0.25)]">
              {/* Map / grid background */}
              {mapBg && (
                <div
                  className="absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-75"
                  style={{
                    backgroundImage: `url(${mapBg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--secondary-warm) 75%, transparent), color-mix(in srgb, var(--primary) 30%, transparent))",
                }}
              />
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-accent-warm">
                      <MapPin className="h-3.5 w-3.5" />
                      Livraison
                    </div>
                    <div className="mt-2 font-black">{profile?.full_name || "—"}</div>
                    {profile?.phone && (
                      <div className="text-xs text-brand-foreground/70">{profile.phone}</div>
                    )}
                    <div className="mt-1 text-sm text-brand-foreground/90">
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
                    className="press flex h-9 flex-shrink-0 items-center rounded-full bg-card px-4 text-xs font-black text-secondary-warm hover:bg-accent-warm"
                  >
                    Modifier
                  </Link>
                </div>
              </div>
            </div>

            {/* Récapitulatif : sous-total, réduction éventuelle, puis total. */}
            <div className="space-y-1 px-2 pt-2">
              {/* On n'affiche le sous-total que s'il y a une réduction à montrer. */}
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
                  <span>Sous-total</span>
                  <span>{fmt(subtotal)} TND</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm font-black text-brand">
                  <span className="flex items-center gap-1.5">
                    <BadgePercent className="h-4 w-4" />
                    Réduction bienvenue -10 %
                  </span>
                  <span>-{fmt(discount)} TND</span>
                </div>
              )}
              {/* Message discret quand l'offre est présente mais non applicable. */}
              {welcomeAlreadyUsed && (
                <div className="text-xs font-semibold text-muted-foreground/70">
                  Offre déjà utilisée
                </div>
              )}

              <div className="flex items-end justify-between pt-1">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Total
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5 text-3xl font-black text-foreground">
                    {fmt(finalTotal)}
                    <span className="text-sm font-black text-muted-foreground">TND</span>
                  </div>
                </div>
                <div className="rounded-full bg-accent-warm px-3 py-1 text-[11px] font-black text-secondary-warm">
                  Paiement sur place
                </div>
              </div>
            </div>

            {/* Action button — part of the page, not fixed */}
            <button
              disabled={!canSubmit}
              onClick={confirm}
              className="press h-14 w-full rounded-full bg-brand text-base font-black text-brand-foreground shadow-lg transition-[filter] hover:brightness-95 disabled:opacity-50"
            >
              {submitting
                ? "Envoi…"
                : outOfZone
                  ? "Adresse hors zone"
                  : `Confirmer la commande · ${fmt(finalTotal)} TND`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
