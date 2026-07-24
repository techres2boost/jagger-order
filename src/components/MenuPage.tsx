import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// useLayoutEffect côté client, useEffect en SSR (évite l'avertissement React).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

import { fmt } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  ShoppingCart,
  Plus,
  User as UserIcon,
  LogOut,
  Shield,
  Search,
  SlidersHorizontal,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowRight,
  X,
} from "lucide-react";
import { BoxLogo } from "@/components/BoxLogo";
import { useAvatar } from "@/lib/use-avatar";
import { EnableNotifications } from "@/components/EnableNotifications";
import burger3d from "@/assets/burger-3d.png";
import pizza3d from "@/assets/pizza-3d.png";
import drink3d from "@/assets/drink-3d.png";

const PROMO_CARDS = [
  { img: burger3d, alt: "Burger 3D" },
  { img: pizza3d, alt: "Pizza 3D" },
  { img: drink3d, alt: "Boisson 3D" },
];
import { toast } from "sonner";

const DEFAULT_DISH_COLOR = "#E5E5E5";

type DishSize = { label: string; price: number };

type DishOptionItem = { id: string; name: string; price: number };
type DishOptionGroup = {
  id: string;
  name: string;
  type: "retirable" | "supplement";
  maxSelection: number;
  items: DishOptionItem[];
};

// Vue-modèle du plat, alimentée par les vraies tables Supabase.
type Dish = {
  id: string;
  category: string; // category_id
  name: string;
  description?: string;
  image?: string;
  color?: string;
  populaire?: boolean;
  price?: number;
  sizes?: DishSize[];
  optionGroups?: DishOptionGroup[];
  // Champ sans source en base — laissé optionnel (jamais renseigné) pour
  // conserver le bloc conditionnel existant sans rien inventer.
  incomplete?: boolean;
  composition?: string;
};

type CategoryVM = { id: string; name: string };

export function MenuPage() {
  const [categories, setCategories] = useState<CategoryVM[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<Dish | null>(null);
  const { count, add, lines } = useCart();
  const { user, isAdmin, isLivreur, rolesResolved } = useAuth();
  const navigate = useNavigate();
  const [bounceKey, setBounceKey] = useState(0);
  const [search, setSearch] = useState("");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [showFilter, setShowFilter] = useState(false);
  const promoScrollRef = useRef<HTMLDivElement | null>(null);
  const [promoIndex, setPromoIndex] = useState(0);
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) setBounceKey((k) => k + 1);
    prevCount.current = count;
  }, [count]);

  // Un livreur n'utilise pas l'interface client : on le redirige vers son espace.
  useEffect(() => {
    if (rolesResolved && isLivreur) {
      navigate({ to: "/livreur", replace: true });
    }
  }, [rolesResolved, isLivreur, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catRes, itemRes, sizeRes, linkRes, groupRes, optionItemRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, display_order")
          .order("display_order", { ascending: true }),
        supabase
          .from("menu_items")
          .select("*")
          .eq("is_available", true)
          .order("display_order", { ascending: true }),
        supabase.from("menu_item_sizes").select("*").order("display_order", { ascending: true }),
        supabase
          .from("menu_item_option_groups")
          .select("*")
          .order("display_order", { ascending: true }),
        supabase.from("option_groups").select("*").order("display_order", { ascending: true }),
        supabase.from("option_items").select("*").order("display_order", { ascending: true }),
      ]);
      if (cancelled) return;

      if (
        catRes.error ||
        itemRes.error ||
        sizeRes.error ||
        linkRes.error ||
        groupRes.error ||
        optionItemRes.error
      ) {
        toast.error(
          catRes.error?.message ??
            itemRes.error?.message ??
            sizeRes.error?.message ??
            linkRes.error?.message ??
            groupRes.error?.message ??
            optionItemRes.error?.message ??
            "Erreur de chargement du menu",
        );
        setLoading(false);
        return;
      }

      const cats: CategoryVM[] = (catRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
      const rawItems = itemRes.data ?? [];
      const rawSizes = sizeRes.data ?? [];
      const rawLinks = linkRes.data ?? [];
      const rawGroups = groupRes.data ?? [];
      const rawOptionItems = optionItemRes.data ?? [];

      const sizesByItem = new Map<string, DishSize[]>();
      for (const s of rawSizes) {
        const list = sizesByItem.get(s.menu_item_id) ?? [];
        list.push({ label: s.size_label, price: Number(s.price) });
        sizesByItem.set(s.menu_item_id, list);
      }

      const optionItemsByGroup = new Map<string, DishOptionItem[]>();
      for (const oi of rawOptionItems) {
        const list = optionItemsByGroup.get(oi.group_id) ?? [];
        list.push({ id: oi.id, name: oi.name, price: Number(oi.price) });
        optionItemsByGroup.set(oi.group_id, list);
      }

      const groupsById = new Map(rawGroups.map((g) => [g.id, g]));

      const optionGroupsByItem = new Map<string, DishOptionGroup[]>();
      for (const link of rawLinks) {
        const group = groupsById.get(link.option_group_id);
        if (!group) continue;
        const list = optionGroupsByItem.get(link.menu_item_id) ?? [];
        list.push({
          id: group.id,
          name: group.name,
          type: group.type,
          maxSelection: group.max_selection,
          items: optionItemsByGroup.get(group.id) ?? [],
        });
        optionGroupsByItem.set(link.menu_item_id, list);
      }

      const mapped: Dish[] = rawItems.map((it) => {
        const itemSizes = sizesByItem.get(it.id) ?? [];
        const hasMultipleFormats = itemSizes.length > 1;
        const singleSizePrice = itemSizes.length === 1 ? itemSizes[0].price : null;
        const fixedPrice = it.price != null ? Number(it.price) : singleSizePrice;
        return {
          id: it.id,
          category: it.category_id,
          name: it.name,
          description: it.description ?? undefined,
          image: it.image_url ?? undefined,
          color: it.color ?? undefined,
          populaire: Boolean(it.is_featured),
          price: hasMultipleFormats ? undefined : (fixedPrice ?? undefined),
          sizes: hasMultipleFormats ? itemSizes : undefined,
          optionGroups: optionGroupsByItem.get(it.id) ?? [],
        };
      });

      setCategories(cats);
      setDishes(mapped);
      setActive((current) => current ?? "__all__");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    let list = active === "__all__" ? dishes : active ? dishes.filter((d) => d.category === active) : [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q),
      );
    }
    if (priceSort !== "none") {
      const priceOf = (d: Dish) =>
        d.price ?? (d.sizes && d.sizes.length ? Math.min(...d.sizes.map((s) => s.price)) : Number.POSITIVE_INFINITY);
      list = [...list].sort((a, b) =>
        priceSort === "asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a),
      );
    }
    return list;
  }, [dishes, active, search, priceSort]);
  const populaires = useMemo(() => dishes.filter((d) => d.populaire), [dishes]);
  const activeCategoryName =
    active === "__all__" ? "Tout" : categories.find((c) => c.id === active)?.name;

  // Évite d'afficher l'interface client à un livreur pendant la redirection.
  if (rolesResolved && isLivreur) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirection…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header intégré sur fond blanc */}
      <header className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pt-4 pb-3">
          {/* Top row : logo + search + connexion */}
          <div className="flex items-center gap-3">
            <BoxLogo size={44} showWordmark={false} />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un plat…"
                className="h-11 w-full rounded-2xl border-0 bg-[#F1F2F4] pl-10 pr-16 text-sm font-medium text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
              />
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-foreground/50 hover:bg-black/5"
                  aria-label="Effacer"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                onClick={() => setShowFilter((v) => !v)}
                className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl press ${
                  priceSort !== "none"
                    ? "bg-[color:var(--brand)] text-white"
                    : "text-foreground/60 hover:bg-black/5"
                }`}
                aria-label="Filtrer par prix"
                title="Filtrer par prix"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              {showFilter && (
                <div className="absolute right-0 top-12 z-40 w-52 rounded-2xl bg-white p-2 text-foreground shadow-xl ring-1 ring-black/5">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground/50">
                    Trier par prix
                  </div>
                  {[
                    { key: "none" as const, label: "Par défaut", icon: null },
                    { key: "asc" as const, label: "Prix croissant", icon: <ArrowDownAZ className="h-4 w-4" /> },
                    { key: "desc" as const, label: "Prix décroissant", icon: <ArrowUpAZ className="h-4 w-4" /> },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setPriceSort(opt.key);
                        setShowFilter(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                        priceSort === opt.key ? "bg-[color:var(--brand)]/10 text-[color:var(--brand)]" : "hover:bg-black/5"
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && <EnableNotifications role={isAdmin ? "admin" : "client"} />}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground hover:bg-black/10 press"
                  title="Admin"
                  aria-label="Admin"
                >
                  <Shield className="h-5 w-5" />
                </Link>
              )}
              {user ? (
                <>
                  <HeaderAvatar userId={user.id} />
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      toast.success("Déconnecté");
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground hover:bg-black/10 press"
                    title="Déconnexion"
                    aria-label="Déconnexion"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand)] text-white hover:brightness-110 press shadow-md"
                  title="Connexion"
                  aria-label="Connexion"
                >
                  <UserIcon className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>

          {/* Accroche */}
          <h1 className="mt-5 text-2xl font-black leading-tight text-foreground sm:text-3xl">
            Que voulez-vous commander aujourd'hui ?
          </h1>

          {/* Carrousel promo — swipe */}
          <div className="mt-4 -mx-4">
            <div
              ref={promoScrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const idx = Math.round(el.scrollLeft / el.clientWidth);
                if (idx !== promoIndex) setPromoIndex(idx);
              }}
              className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-4"
            >
              {PROMO_CARDS.map((p, i) => (
                <div key={i} className="w-full shrink-0 snap-center pr-3 last:pr-0">
                  <div className="relative overflow-hidden rounded-3xl bg-[color:var(--brand)] px-5 py-4 shadow-xl">
                    <div className="absolute inset-0 opacity-30 halftone-red pointer-events-none" />
                    <div className="relative flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                          Offre de bienvenue
                        </div>
                        <div className="mt-1 text-2xl font-black leading-tight text-white">
                          -10 % sur votre
                          <br />
                          première commande
                        </div>
                      </div>
                      <img
                        src={p.img}
                        alt={p.alt}
                        width={120}
                        height={120}
                        loading="lazy"
                        className="h-24 w-24 shrink-0 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.35)] rotate-[-6deg]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {PROMO_CARDS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const el = promoScrollRef.current;
                    if (!el) return;
                    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                  }}
                  aria-label={`Promo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    promoIndex === i
                      ? "w-6 bg-[color:var(--brand)]"
                      : "w-1.5 bg-black/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tabs catégories (edges carrés) */}
        <div className="hide-scrollbar-red overflow-x-auto">
          <div className="mx-auto flex max-w-3xl gap-2 px-4 pb-4">
            {[{ id: "__all__", name: "Tout" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition min-h-[42px] press ${
                  active === c.id
                    ? "bg-[color:var(--brand)] text-white shadow-[0_6px_16px_rgba(227,6,19,0.5)]"
                    : "bg-[#F1F2F4] text-foreground/80 hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl">
        {/* Populaires — minimal, invisible cards, seamless with white bg */}
        {populaires.length > 0 && (
          <section className="px-4 pt-6 pb-2">
            <h2 className="mb-3 text-xl font-black text-foreground">Plats populaires</h2>

            <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
              {populaires.map((it) => {
                const qtyInCart = lines
                  .filter((l) => l.itemId === it.id)
                  .reduce((s, l) => s + l.qty, 0);
                return (
                  <PopularCard
                    key={it.id}
                    item={it}
                    onOpen={setSelected}
                    onAdd={add}
                    qtyInCart={qtyInCart}
                  />
                );
              })}
              {populaires.length < 4 && (
                <button
                  onClick={() => {
                    setActive("__all__");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 press"
                  aria-label="Voir tout le menu"
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F1F2F4] text-[color:var(--brand)] shadow-inner">
                    <ArrowRight className="h-8 w-8" />
                  </div>
                  <span className="text-xs font-bold text-foreground/70">Voir tout</span>
                </button>
              )}
            </div>
          </section>
        )}



        {/* Grid catégorie */}
        <section className="px-4 pt-6">
          <h2 className="section-title mb-4 text-xl font-black">{activeCategoryName}</h2>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement du menu…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun plat dans cette catégorie.
            </p>
          )}
          <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
            {items.map((it) => {
              const qtyInCart = lines
                .filter((l) => l.itemId === it.id)
                .reduce((s, l) => s + l.qty, 0);
              return (
                <ProductCard
                  key={it.id}
                  item={it}
                  onOpen={setSelected}
                  onAdd={add}
                  qtyInCart={qtyInCart}
                />
              );
            })}
          </div>
        </section>
      </main>

      {/* Bouton panier flottant */}
      {count > 0 && (
        <Link
          key={bounceKey}
          to="/panier"
          className="fixed bottom-16 right-5 z-[60] flex h-14 items-center gap-2 rounded-full brand-gradient px-5 text-white shadow-2xl press cart-bounce"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="font-bold">Panier</span>
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-black text-[color:var(--brand)]">
            {count}
          </span>
        </Link>
      )}

      {selected && <DishDetail item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function displayName(item: Dish) {
  return item.category?.toLowerCase() === "pizzas" ? `Pizza ${item.name}` : item.name;
}

function DishThumb({ item, className }: { item: Dish; className?: string }) {
  if (!item.image) {
    return (
      <div
        className={`h-full w-full ${className ?? ""}`}
        style={{ backgroundColor: item.color || DEFAULT_DISH_COLOR }}
      />
    );
  }
  return (
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      className={`h-full w-full object-contain appetizing drop-shadow-[0_14px_18px_rgba(0,0,0,0.28)] ${className ?? ""}`}
      style={{ filter: "saturate(1.15) contrast(1.05)" }}
    />
  );
}


function PopularCard({
  item,
  onOpen,
  onAdd,
  qtyInCart = 0,
}: {
  item: Dish;
  onOpen: (i: Dish) => void;
  onAdd: (i: { itemId: string; name: string; unitPrice: number; qty: number }) => void;
  qtyInCart?: number;
}) {
  const hasSizes = Boolean(item.sizes && item.sizes.length > 0);
  const minSizePrice = hasSizes ? Math.min(...item.sizes!.map((s) => s.price)) : null;
  const price = minSizePrice ?? item.price ?? null;
  const inCart = qtyInCart > 0;
  return (
    <div className="relative flex w-32 shrink-0 flex-col items-center pt-2">
      <button
        onClick={() => onOpen(item)}
        className="group flex w-full flex-col items-center text-center"
      >
        <div className="relative h-24 w-24">
          <div className="absolute inset-x-3 bottom-1 h-3 rounded-full bg-black/30 blur-lg" />
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="relative h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.28)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105"
              style={{ filter: "saturate(1.15) contrast(1.05)" }}
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#F1F2F4]">
              <BoxLogo size={48} showWordmark={false} />
            </div>
          )}
        </div>
        <div className="mt-4 line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-tight text-foreground">
          {displayName(item)}
        </div>
        {price != null && (
          <div className="mt-1 text-sm font-black text-foreground">
            {hasSizes ? `dès ${fmt(price)}` : fmt(price)}
            <span className="ml-1 text-[10px] font-bold text-foreground/50">TND</span>
          </div>
        )}
      </button>
      {!item.incomplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="press absolute right-0 top-16 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand)] text-white shadow-lg ring-2 ring-white"
          aria-label="Ajouter au panier"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          {inCart && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-[color:var(--brand)] shadow">
              x{qtyInCart}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function ProductCard({
  item,
  onOpen,
  onAdd,
  qtyInCart = 0,
  featured = false,
}: {
  item: Dish;
  onOpen: (i: Dish) => void;
  onAdd: (i: { itemId: string; name: string; unitPrice: number; qty: number }) => void;
  qtyInCart?: number;
  featured?: boolean;
}) {
  const hasSizes = Boolean(item.sizes && item.sizes.length > 0);
  const minSizePrice = hasSizes ? Math.min(...item.sizes!.map((s) => s.price)) : null;
  const price = minSizePrice ?? item.price ?? null;
  const inCart = qtyInCart > 0;
  const radius = featured ? "rounded-[20px]" : "rounded-[18px]";
  const highlight = inCart
    ? `ring-2 ring-brand ${radius}`
    : `${radius}`;

  return (
    <div
      className={`relative flex h-[280px] flex-col overflow-hidden ${radius} bg-[#F1F2F4] card-hover ${highlight}`}
    >
      <button onClick={() => onOpen(item)} className="flex h-full w-full flex-col text-left">
        <div className="relative h-[160px] w-full shrink-0 p-3">
          <div className="absolute inset-x-6 bottom-3 h-3 rounded-full bg-black/20 blur-md" />
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="relative h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.22)] transition-transform duration-300 hover:scale-105"
              style={{ filter: "saturate(1.15) contrast(1.05)" }}
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-white/60">
              <BoxLogo size={56} showWordmark={false} />
            </div>
          )}
          {item.populaire && (
            <div className="pop-badge absolute left-2 top-2 rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--gold-foreground)] shadow">
              ★ Populaire
            </div>
          )}
          {item.incomplete && (
            <div className="absolute left-2 top-2 rounded-full bg-warning/90 px-2 py-0.5 text-[10px] font-bold text-white">
              À compléter
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between px-4 pb-4 pt-1 pr-14">
          <div className="mt-2 line-clamp-2 h-[2.5rem] overflow-hidden text-sm font-bold leading-tight text-black">
            {displayName(item)}
          </div>
          <div className="h-6 text-base font-black leading-6 text-black">
            {price != null ? (
              <>
                {hasSizes ? `dès ${fmt(price)}` : fmt(price)}
                <span className="ml-1 text-[10px] font-bold text-black/60">TND</span>
              </>
            ) : null}
          </div>
        </div>
      </button>
      {!item.incomplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="press absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand)] text-white shadow-lg"
          aria-label="Ajouter au panier"
        >
          <Plus className="h-5 w-5" strokeWidth={3} />
          {inCart && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-[color:var(--brand)] shadow">
              x{qtyInCart}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function DishDetail({ item, onClose }: { item: Dish; onClose: () => void }) {
  const { add } = useCart();
  const [sizeIdx, setSizeIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [imageOpen, setImageOpen] = useState(false);
  // Sélections par groupe d'options : groupId -> ids des option_items choisis
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  // Mesures de la fenêtre pour dimensionner la feuille modale :
  //  - layoutH : hauteur du viewport de mise en page (window.innerHeight)
  //  - keyboardInset : espace mangé par le clavier virtuel en bas (visualViewport)
  // Cela garantit que le footer (bouton « Ajouter au panier ») reste visible,
  // au-dessus de la bottom nav ET du clavier, sur toutes les tailles d'écran.
  const [viewport, setViewport] = useState<{ layoutH: number; keyboardInset: number } | null>(null);
  useIsomorphicLayoutEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const layoutH = window.innerHeight;
      const keyboardInset = vv ? Math.max(0, layoutH - vv.height - vv.offsetTop) : 0;
      setViewport({ layoutH, keyboardInset });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  const optionGroups = item.optionGroups ?? [];
  const size = item.sizes?.[sizeIdx];
  const base = size ? size.price : (item.price ?? 0);
  const supplementsTotal = optionGroups.reduce((sum, group) => {
    if (group.type !== "supplement") return sum;
    const selectedIds = selections[group.id] ?? [];
    return (
      sum + group.items.filter((i) => selectedIds.includes(i.id)).reduce((s, i) => s + i.price, 0)
    );
  }, 0);
  const total = (base + supplementsTotal) * qty;

  function toggleOption(group: DishOptionGroup, optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.maxSelection) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  // Dégagement en bas : le plus grand entre la bottom nav et le clavier virtuel,
  // pour que le footer reste toujours visible. --bottom-nav-height est mesurée au
  // runtime (voir BottomNavBar) : aucune valeur en dur.
  const bottomInset = viewport
    ? `max(var(--bottom-nav-height), ${viewport.keyboardInset}px)`
    : "var(--bottom-nav-height)";
  // Hauteur de la feuille = min(92dvh, espace visible réel − dégagement bas).
  // Le footer étant un enfant flex non rétractable, la zone scrollable occupe
  // le reste (hauteur fenêtre − footer), donc le bouton n'est jamais masqué.
  const sheetStyle = {
    height: "92dvh",
    maxHeight: viewport
      ? `calc(${viewport.layoutH}px - ${bottomInset})`
      : "calc(100dvh - var(--bottom-nav-height))",
    marginBottom: bottomInset,
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-product-modal)] flex items-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
        className="relative flex w-full flex-col rounded-t-3xl bg-background animate-in slide-in-from-bottom duration-300"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Photo — fond rouge, vague en bas, image non recadrée */}
          <div className="relative bg-brand pt-8 pb-16">
            <button
              onClick={onClose}
              className="press absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-brand-dark shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
            >
              ✕
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageOpen(true);
              }}
              className="relative mx-auto block h-56 w-full"
              aria-label="Voir l'image en plein écran"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="mx-auto h-full w-auto max-w-[80%] object-contain drop-shadow-[0_16px_20px_rgba(0,0,0,0.28)]"
                />
              ) : (
                <div className="mx-auto flex h-full w-56 items-center justify-center">
                  <BoxLogo size={100} showWordmark={false} />
                </div>
              )}
            </button>
            <svg
              className="absolute -bottom-px left-0 right-0 h-10 w-full text-background"
              viewBox="0 0 1440 80"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                fill="currentColor"
                d="M0,32 C240,96 480,0 720,32 C960,64 1200,16 1440,48 L1440,80 L0,80 Z"
              />
            </svg>
          </div>

          <div className="mx-auto max-w-2xl px-5 pt-5">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-black">{item.name}</h2>
              <div className="whitespace-nowrap text-2xl font-black text-[color:var(--gold)]">
                {fmt(base)} <span className="text-sm font-bold text-foreground/50">TND</span>
              </div>
            </div>
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            )}

            {/* Quantité — juste sous la description */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Quantité
              </span>
              <div className="ml-auto flex items-center gap-3 rounded-full border px-1 py-1">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="press h-9 w-9 rounded-full bg-secondary font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="press h-9 w-9 rounded-full bg-[#B22222] font-bold text-white"
                >
                  +
                </button>
              </div>
            </div>

            {item.incomplete && (
              <div className="mt-4 rounded-lg bg-warning/10 p-3 text-xs font-medium text-warning-foreground">
                ⚠️ Information à compléter par l'établissement.
              </div>
            )}

            {item.sizes && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Format
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.sizes.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => setSizeIdx(i)}
                      className={`press rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        i === sizeIdx
                          ? "bg-brand text-brand-foreground shadow-md"
                          : "bg-secondary hover:bg-secondary/70"
                      }`}
                    >
                      {s.label} · {fmt(s.price)} TND
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.composition && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Composition
                </h3>
                <p className="rounded-xl bg-secondary/60 p-3 text-sm text-foreground">
                  {item.composition}
                </p>
              </div>
            )}

            {optionGroups.map((group) => {
              const selectedIds = selections[group.id] ?? [];
              const limitReached = selectedIds.length >= group.maxSelection;
              return (
                <div key={group.id} className="mt-5">
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    {group.name}
                  </h3>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Choisissez un maximum de {group.maxSelection} produits
                  </p>
                  {limitReached && (
                    <p className="mb-2 rounded-lg bg-warning/10 p-2 text-xs font-medium text-warning-foreground">
                      Limite atteinte pour « {group.name} ».
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {group.items.map((optionItem) => {
                      const checked = selectedIds.includes(optionItem.id);
                      const disabled = !checked && limitReached;
                      return (
                        <label
                          key={optionItem.id}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all duration-200 ${
                            checked
                              ? "border-[#B22222] bg-[#B22222]/5 shadow-[0_2px_10px_rgba(178,34,34,0.15)]"
                              : "border-transparent bg-secondary/50 hover:border-[#B22222]/40 hover:bg-[#B22222]/5 hover:-translate-y-0.5"
                          } ${disabled ? "cursor-not-allowed opacity-40 hover:translate-y-0" : ""}`}
                        >
                          <span className="text-sm font-medium">{optionItem.name}</span>
                          <span className="flex items-center gap-3">
                            {group.type === "supplement" && (
                              <span className="text-sm font-bold text-[#B22222]">
                                +{fmt(optionItem.price)} TND
                              </span>
                            )}
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleOption(group, optionItem.id)}
                              className="h-5 w-5 accent-[#B22222]"
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-2xl items-center gap-5">
            <div className="shrink-0">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-black text-[color:var(--gold)]">
                {fmt(total)}{" "}
                <span className="text-xs font-bold text-foreground/50">TND</span>
              </div>
            </div>
            <button
              disabled={item.incomplete}
              onClick={() => {
                const selectedOptions = optionGroups.flatMap((group) =>
                  (selections[group.id] ?? [])
                    .map((optId) => group.items.find((i) => i.id === optId))
                    .filter((i): i is DishOptionItem => Boolean(i))
                    .map((i) => ({
                      groupId: group.id,
                      groupName: group.name,
                      optionItemId: i.id,
                      name: i.name,
                      price: group.type === "supplement" ? i.price : 0,
                      type: group.type,
                    })),
                );
                add({
                  itemId: item.id,
                  name: item.name,
                  size: size?.label,
                  unitPrice: base,
                  qty,
                  options: selectedOptions,
                });
                toast.success(`${item.name} ajouté au panier`);
                onClose();
              }}
              className="press ml-auto flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#B22222] px-4 font-bold text-white disabled:opacity-40"
            >
              <ShoppingCart className="h-5 w-5" />
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>




      {imageOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setImageOpen(false)}
        >
          <button
            onClick={() => setImageOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            ✕
          </button>
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <BoxLogo size={120} showWordmark={false} />
          )}
        </div>
      )}
    </div>
  );
}

// Petit avatar utilisateur dans le header : photo si dispo, sinon icône générique.
function HeaderAvatar({ userId }: { userId: string }) {
  const { avatarUrl } = useAvatar(userId);
  return (
    <Link
      to="/compte"
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-black/5 text-foreground hover:bg-black/10 press"
      title="Mon compte"
      aria-label="Mon compte"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserIcon className="h-5 w-5" />
      )}
    </Link>
  );
}
