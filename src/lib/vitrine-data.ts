import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Données du site vitrine — lues en lecture seule depuis les MÊMES tables
// Supabase que le panneau admin et l'app de commande (categories, menu_items,
// menu_item_sizes). Aucune copie statique, aucune URL d'image codée en dur :
// les photos proviennent de `image_url` (Supabase Storage, bucket dish-images).
//
// Ce module NE modifie rien de l'app existante : il ne fait que lire.

export type VitrineCategory = { id: string; name: string };

export type VitrineItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  featured: boolean;
  // Prix « à partir de » (plus petit format), ou undefined si aucun prix en base.
  priceFrom?: number;
  hasMultipleSizes: boolean;
};

export type VitrineData = {
  loading: boolean;
  error: string | null;
  categories: VitrineCategory[];
  items: VitrineItem[];
  featured: VitrineItem[];
  // Statistiques calculées dynamiquement (jamais codées en dur).
  productCount: number;
  categoryCount: number;
};

const EMPTY: Omit<VitrineData, "loading" | "error"> = {
  categories: [],
  items: [],
  featured: [],
  productCount: 0,
  categoryCount: 0,
};

export function useVitrineMenu(): VitrineData {
  const [state, setState] = useState<VitrineData>({
    loading: true,
    error: null,
    ...EMPTY,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [catRes, itemRes, sizeRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, display_order")
          .order("display_order", { ascending: true }),
        supabase
          .from("menu_items")
          .select("id, category_id, name, description, image_url, is_featured, display_order")
          .eq("is_available", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("menu_item_sizes")
          .select("menu_item_id, price, display_order")
          .order("display_order", { ascending: true }),
      ]);

      if (cancelled) return;

      if (catRes.error || itemRes.error || sizeRes.error) {
        setState({
          loading: false,
          error:
            catRes.error?.message ??
            itemRes.error?.message ??
            sizeRes.error?.message ??
            "Erreur de chargement du menu",
          ...EMPTY,
        });
        return;
      }

      // Prix minimum par article (le plus petit format disponible).
      const minPriceByItem = new Map<string, number>();
      const sizeCountByItem = new Map<string, number>();
      for (const s of sizeRes.data ?? []) {
        const price = Number(s.price);
        if (!Number.isFinite(price)) continue;
        const current = minPriceByItem.get(s.menu_item_id);
        if (current == null || price < current) minPriceByItem.set(s.menu_item_id, price);
        sizeCountByItem.set(s.menu_item_id, (sizeCountByItem.get(s.menu_item_id) ?? 0) + 1);
      }

      const categories: VitrineCategory[] = (catRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
      }));

      const items: VitrineItem[] = (itemRes.data ?? []).map((it) => {
        const sizeCount = sizeCountByItem.get(it.id) ?? 0;
        return {
          id: it.id,
          categoryId: it.category_id ?? "",
          name: it.name,
          description: it.description ?? undefined,
          image: it.image_url ?? undefined,
          featured: Boolean(it.is_featured),
          priceFrom: minPriceByItem.get(it.id),
          hasMultipleSizes: sizeCount > 1,
        };
      });

      // On n'affiche que les catégories qui contiennent réellement des articles.
      const usedCategoryIds = new Set(items.map((i) => i.categoryId));
      const usedCategories = categories.filter((c) => usedCategoryIds.has(c.id));

      setState({
        loading: false,
        error: null,
        categories: usedCategories,
        items,
        featured: items.filter((i) => i.featured),
        productCount: items.length,
        categoryCount: usedCategories.length,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
