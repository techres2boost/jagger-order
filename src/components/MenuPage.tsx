import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

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
  X,
} from "lucide-react";
import { BoxLogo } from "@/components/BoxLogo";
import { EnableNotifications } from "@/components/EnableNotifications";
import burger3d from "@/assets/burger-3d.png";
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
      setActive((current) => current ?? cats[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () => (active ? dishes.filter((d) => d.category === active) : []),
    [dishes, active],
  );
  const populaires = useMemo(() => dishes.filter((d) => d.populaire), [dishes]);
  const activeCategory = categories.find((c) => c.id === active);

  // Évite d'afficher l'interface client à un livreur pendant la redirection.
  if (rolesResolved && isLivreur) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirection…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/40 hero-gradient text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <BoxLogo size={56} showWordmark={false} />

          <div className="flex items-center gap-2">
            {user && <EnableNotifications role={isAdmin ? "admin" : "client"} />}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
              >
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
            {user ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Déconnecté");
                }}
                className="flex h-9 items-center gap-1 rounded-full border border-white/30 px-3 text-xs font-semibold text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Sortir
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex h-9 items-center gap-1 rounded-full brand-gradient px-4 text-xs font-semibold text-white press shadow-lg"
              >
                <UserIcon className="h-4 w-4" /> Connexion
              </Link>
            )}
          </div>
        </div>

        {/* Bandeau livraison */}
        <div className="halftone-red text-brand-foreground">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-xs font-semibold">
            <Truck className="h-4 w-4" /> Livraison de repas à domicile disponible
          </div>
        </div>

        {/* Tabs catégories */}
        <div className="hide-scrollbar-red overflow-x-auto shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
          <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition min-h-[44px] press ${
                  active === c.id
                    ? "brand-gradient text-white shadow-[0_6px_16px_rgba(227,6,19,0.45)]"
                    : "bg-white text-foreground/70 border border-border hover:border-brand/40 hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Diagonal divider between hero and content */}
      <div className="diagonal-divider" />

      <main className="mx-auto max-w-3xl">
        {/* Populaires — featured zone with red tint */}
        {populaires.length > 0 && (
          <section className="tint-red px-4 pt-5 pb-6 rounded-b-[28px]">
            <h2 className="section-title mb-4 text-xl font-black">Plats populaires</h2>
            <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {populaires.map((it) => {
                const qtyInCart = lines
                  .filter((l) => l.itemId === it.id)
                  .reduce((s, l) => s + l.qty, 0);
                return (
                  <div key={it.id} className="w-48 shrink-0">
                    <ProductCard
                      item={it}
                      onOpen={setSelected}
                      onAdd={add}
                      qtyInCart={qtyInCart}
                      featured
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Grid catégorie */}
        <section className="px-4 pt-6">
          <h2 className="section-title mb-4 text-xl font-black">{activeCategory?.name}</h2>
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
      className={`h-full w-full object-cover appetizing ${className ?? ""}`}
    />
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
  const radius = featured ? "rounded-[20px]" : "rounded-[14px]";
  const highlight = inCart
    ? `border-2 border-brand ring-2 ring-brand/20 ${radius}`
    : `border border-transparent ${radius}`;

  // ─── Design spécial catégorie Pizza : photo flottante en forme organique ───
  if (item.category === "pizzas") {
    return (
      <div
        className={`relative flex h-full flex-col overflow-hidden ${radius} bg-card px-3 pb-3 pt-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)] card-hover ${highlight}`}
      >
        <button onClick={() => onOpen(item)} className="flex flex-1 flex-col text-left">
          <div className="relative mx-auto mb-3 h-28 w-28">
            <div className="absolute inset-x-4 bottom-1 h-3 rounded-full bg-black/25 blur-md" />
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                loading="lazy"
                className="relative h-full w-full rounded-full border border-black/5 object-cover drop-shadow-[0_8px_12px_rgba(0,0,0,0.18)] transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center rounded-full border border-black/5 bg-gradient-to-br from-accent to-secondary">
                <BoxLogo size={56} showWordmark={false} />
              </div>
            )}
            {item.populaire && (
              <div className="pop-badge absolute -left-1 -top-1 rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--gold-foreground)] shadow">
                ★ Populaire
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col">
            {item.name && (
              <div className="line-clamp-2 min-h-[2.5rem] text-sm font-bold">{item.name}</div>
            )}
            {price != null && (
              <div className="mt-auto pt-2 text-base font-black text-[color:var(--gold)]">
                {hasSizes ? `dès ${fmt(price)}` : fmt(price)}
              </div>
            )}
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="press absolute bottom-3 right-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full brand-gradient text-white shadow-lg"
          aria-label="Voir la pizza"
        >
          <Plus className="h-5 w-5" />
          {inCart && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-[color:var(--brand)] shadow">
              x{qtyInCart}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden ${radius} bg-card shadow-[0_1px_4px_rgba(0,0,0,0.08)] card-hover ${highlight}`}
    >
      <button onClick={() => onOpen(item)} className="flex flex-1 flex-col text-left">
        <div
          className={`relative aspect-square w-full overflow-hidden ${featured ? "rounded-t-[20px]" : "rounded-t-[14px]"}`}
        >
          <DishThumb item={item} className="transition-transform duration-300 hover:scale-105" />
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
        <div className="flex flex-1 flex-col p-3 pb-14">
          {item.name && (
            <div className="line-clamp-2 min-h-[2.5rem] text-sm font-bold">{item.name}</div>
          )}
          {price != null && (
            <div className="mt-auto pt-2 text-base font-black text-[color:var(--gold)]">
              {hasSizes ? `dès ${fmt(price)}` : fmt(price)}
            </div>
          )}
        </div>
      </button>
      {!item.incomplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="press absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full brand-gradient text-white shadow-lg"
          aria-label="Ajouter au panier"
        >
          <Plus className="h-5 w-5" />
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-background pb-40 animate-in slide-in-from-bottom duration-300"
      >
        {/* Image — floating pour pizza, plein cadre sinon */}
        {item.category === "pizzas" ? (
          <div className="relative bg-card px-5 pb-4 pt-8">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-brand-dark shadow"
            >
              ✕
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageOpen(true);
              }}
              className="relative mx-auto block h-56 w-56"
              aria-label="Voir l'image en plein écran"
            >
              <div className="absolute inset-x-8 bottom-2 h-5 rounded-full bg-black/25 blur-xl" />
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="relative h-full w-full rounded-full border border-black/5 object-cover drop-shadow-[0_16px_20px_rgba(0,0,0,0.22)]"
                />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-black/5 bg-gradient-to-br from-accent to-secondary">
                  <BoxLogo size={80} showWordmark={false} />
                </div>
              )}
            </button>
          </div>
        ) : (
          <div className="relative h-[40%] bg-brand">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImageOpen(true);
              }}
              className="block h-full w-full"
              aria-label="Voir l'image en plein écran"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full rounded-b-[2.5rem] object-cover"
                />
              ) : (
                <div
                  className="h-full w-full rounded-b-[2.5rem]"
                  style={{ backgroundColor: item.color || DEFAULT_DISH_COLOR }}
                />
              )}
            </button>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-brand-dark shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
            >
              ✕
            </button>
          </div>
        )}

        <div className="mx-auto max-w-2xl px-5 pt-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-black">{item.name}</h2>
            <div className="whitespace-nowrap text-2xl font-black text-[color:var(--gold)]">
              {fmt(base)}
            </div>
          </div>
          {item.description && (
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
          )}
          {item.incomplete && (
            <div className="mt-3 rounded-lg bg-warning/10 p-3 text-xs font-medium text-warning-foreground">
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
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      i === sizeIdx ? "bg-brand text-brand-foreground" : "bg-secondary"
                    }`}
                  >
                    {s.label} · {fmt(s.price)}
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
                        className={`flex items-center justify-between rounded-xl border p-3 ${disabled ? "opacity-40" : ""}`}
                      >
                        <span className="text-sm font-medium">{optionItem.name}</span>
                        <span className="flex items-center gap-3">
                          {group.type === "supplement" && (
                            <span className="text-sm font-bold text-[color:var(--gold)]">
                              +{fmt(optionItem.price)}
                            </span>
                          )}
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleOption(group, optionItem.id)}
                            className="h-5 w-5 accent-[color:var(--brand)]"
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Quantité
            </span>
            <div className="ml-auto flex items-center gap-3 rounded-full border px-1 py-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-9 w-9 rounded-full bg-secondary font-bold"
              >
                −
              </button>
              <span className="w-6 text-center font-bold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="h-9 w-9 rounded-full bg-secondary font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-30 border-t bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-2xl items-center gap-5">
            <div className="shrink-0">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-black text-[color:var(--gold)]">{fmt(total)}</div>
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
              className="ml-auto h-12 flex-1 rounded-full bg-[#B22222] px-4 font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
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
