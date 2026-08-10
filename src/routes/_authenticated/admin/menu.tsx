import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Edit3, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/menu")({
  ssr: false,
  component: AdminMenuPage,
});

interface CategoryRow {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  color: string | null;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface MenuItemSizeRow {
  id: string;
  menu_item_id: string;
  size_label: string;
  price: number;
  display_order: number;
}

interface OptionGroupRow {
  id: string;
  name: string;
  type: "retirable" | "supplement";
  max_selection: number;
  display_order: number;
}

interface CategoryFormState {
  id?: string;
  name: string;
}

interface ItemSizeFormRow {
  id?: string;
  label: string;
  price: string;
}

interface ItemFormState {
  id?: string;
  category_id: string;
  name: string;
  description: string;
  sizes: ItemSizeFormRow[];
  color: string;
  imageUrl: string | null;
  isFeatured: boolean;
  optionGroupIds: string[];
}

// no slug generation — categories don't have a slug column

const DISH_IMAGES_BUCKET = "dish-images";
const DEFAULT_DISH_COLOR = "#E5E5E5";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Extrait le chemin du fichier dans le bucket à partir d'une URL publique Supabase.
function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/${DISH_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

function formatSizes(sizes: Array<{ label: string; price: number }> | null) {
  if (!sizes || sizes.length === 0) return "—";
  return sizes.map((size) => `${size.label} — ${size.price.toFixed(3)} TND`).join(", ");
}

function AdminMenuPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [sizesByItemId, setSizesByItemId] = useState<Record<string, MenuItemSizeRow[]>>({});
  const [originalSizes, setOriginalSizes] = useState<MenuItemSizeRow[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>([]);
  const [groupIdsByItemId, setGroupIdsByItemId] = useState<Record<string, string[]>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState | null>(null);
  // Erreurs inline « doublon » affichées sous le champ nom concerné.
  const [categoryNameError, setCategoryNameError] = useState<string | null>(null);
  const [itemNameError, setItemNameError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () =>
      categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId],
  );

  const categoryItems = useMemo(
    () => items.filter((item) => item.category_id === selectedCategory?.id),
    [items, selectedCategory],
  );

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  async function loadMenu() {
    setLoading(true);
    const [
      { data: categoriesData, error: categoriesError },
      { data: itemsData, error: itemsError },
      { data: sizesData, error: sizesError },
      { data: optionGroupsData, error: optionGroupsError },
      { data: linksData, error: linksError },
    ] = await Promise.all([
      supabase.from("categories").select("*").order("display_order", { ascending: true }),
      supabase.from("menu_items").select("*").order("display_order", { ascending: true }),
      supabase.from("menu_item_sizes").select("*").order("display_order", { ascending: true }),
      supabase.from("option_groups").select("*").order("display_order", { ascending: true }),
      supabase
        .from("menu_item_option_groups")
        .select("*")
        .order("display_order", { ascending: true }),
    ]);

    setLoading(false);

    if (categoriesError) {
      toast.error(categoriesError.message);
      return;
    }

    if (itemsError) {
      toast.error(itemsError.message);
      return;
    }

    if (sizesError) {
      toast.error(sizesError.message);
      return;
    }

    if (optionGroupsError) {
      toast.error(optionGroupsError.message);
      return;
    }

    if (linksError) {
      toast.error(linksError.message);
      return;
    }

    setCategories((categoriesData as CategoryRow[]) ?? []);
    setItems((itemsData as MenuItemRow[]) ?? []);
    setOptionGroups((optionGroupsData as OptionGroupRow[]) ?? []);

    const grouped: Record<string, MenuItemSizeRow[]> = {};
    for (const size of (sizesData as MenuItemSizeRow[]) ?? []) {
      (grouped[size.menu_item_id] ||= []).push(size);
    }
    setSizesByItemId(grouped);

    const groupedLinks: Record<string, string[]> = {};
    for (const link of linksData ?? []) {
      (groupedLinks[link.menu_item_id] ||= []).push(link.option_group_id);
    }
    setGroupIdsByItemId(groupedLinks);
  }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryForm) return;

    const name = categoryForm.name.trim();
    if (!name) {
      toast.error("Le nom de la catégorie est requis.");
      return;
    }

    // Vérification préventive : un nom identique (insensible casse + espaces)
    // existe-t-il déjà ? On exclut la catégorie en cours d'édition.
    const norm = name.toLowerCase();
    const { data: existing, error: checkError } = await supabase
      .from("categories")
      .select("id, name");
    if (checkError) {
      toast.error(checkError.message);
      return;
    }
    const duplicate = (existing ?? []).some(
      (c) => (c.name ?? "").trim().toLowerCase() === norm && c.id !== categoryForm.id,
    );
    if (duplicate) {
      setCategoryNameError("Cette catégorie existe déjà");
      return;
    }
    setCategoryNameError(null);

    const values = {
      id: categoryForm.id,
      name,
      display_order: categories.length + 1,
    };

    const { error } = await supabase.from("categories").upsert(values);
    if (error) {
      // Filet de sécurité : violation d'unicité (double clic / course).
      if (error.code === "23505") {
        setCategoryNameError("Cette catégorie existe déjà");
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success(`Catégorie ${categoryForm.id ? "mise à jour" : "créée"}`);
    setCategoryForm(null);
    loadMenu();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Supprimer cette catégorie et tous ses plats ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Catégorie supprimée.");
    if (selectedCategoryId === id) {
      setSelectedCategoryId(null);
    }
    loadMenu();
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!itemForm) return;

    const itemName = itemForm.name.trim();
    if (!itemName) {
      toast.error("Le nom du plat est requis.");
      return;
    }

    if (!itemForm.category_id) {
      toast.error("La catégorie du plat est requise.");
      return;
    }

    // Vérification préventive : un plat du même nom (insensible casse + espaces)
    // existe-t-il déjà DANS la catégorie sélectionnée ? On exclut le plat en
    // cours d'édition. (Le même nom reste autorisé dans une autre catégorie.)
    const normItem = itemName.toLowerCase();
    const { data: existingItems, error: itemCheckError } = await supabase
      .from("menu_items")
      .select("id, name")
      .eq("category_id", itemForm.category_id);
    if (itemCheckError) {
      toast.error(itemCheckError.message);
      return;
    }
    const itemDuplicate = (existingItems ?? []).some(
      (it) => (it.name ?? "").trim().toLowerCase() === normItem && it.id !== itemForm.id,
    );
    if (itemDuplicate) {
      setItemNameError("Un plat avec ce nom existe déjà dans cette catégorie");
      return;
    }
    setItemNameError(null);

    const parsedSizes: Array<{ id?: string; label: string; price: number }> = [];

    if (isPizzaCategoryId(itemForm.category_id)) {
      // Pizzas : plusieurs formats possibles, chacun avec son nom et son prix.
      const trimmedSizes = itemForm.sizes
        .map((s) => ({ id: s.id, label: s.label.trim(), price: s.price.trim() }))
        .filter((s) => s.label || s.price);

      if (trimmedSizes.length === 0) {
        toast.error("Ajoutez au moins un format avec un prix.");
        return;
      }

      for (const s of trimmedSizes) {
        if (!s.label) {
          toast.error("Chaque format doit avoir un nom.");
          return;
        }
        const priceValue = Number(s.price.replace(",", "."));
        if (!s.price || Number.isNaN(priceValue) || priceValue < 0) {
          toast.error(`Prix invalide pour le format « ${s.label} ».`);
          return;
        }
        parsedSizes.push({ id: s.id, label: s.label, price: priceValue });
      }
    } else {
      // Autres catégories : un seul prix fixe, stocké comme unique format "Standard"
      // (une seule ligne dans menu_item_sizes, cohérent avec la lecture côté client).
      const first = itemForm.sizes[0];
      const priceStr = (first?.price ?? "").trim();
      const priceValue = Number(priceStr.replace(",", "."));
      if (!priceStr || Number.isNaN(priceValue) || priceValue < 0) {
        toast.error("Prix invalide.");
        return;
      }
      parsedSizes.push({ id: first?.id, label: "Standard", price: priceValue });
    }

    const values: TablesInsert<"menu_items"> = {
      id: itemForm.id,
      category_id: itemForm.category_id,
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      is_available: true,
      is_featured: itemForm.isFeatured,
      display_order: categoryItems.length + 1,
    };

    // Insert or update the menu_item and retrieve its id reliably
    let itemId: string | undefined = itemForm.id;

    if (itemForm.id) {
      const { data, error } = await supabase
        .from("menu_items")
        .update(values)
        .eq("id", itemForm.id)
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          setItemNameError("Un plat avec ce nom existe déjà dans cette catégorie");
          return;
        }
        toast.error(error.message);
        return;
      }
      itemId = data?.id;
    } else {
      const { data, error } = await supabase
        .from("menu_items")
        .insert(values)
        .select("id")
        .single();

      if (error) {
        // Filet de sécurité : violation d'unicité (double clic / course).
        if (error.code === "23505") {
          setItemNameError("Un plat avec ce nom existe déjà dans cette catégorie");
          return;
        }
        toast.error(error.message);
        return;
      }
      itemId = data?.id;
    }

    if (!itemId) {
      toast.error("Supabase n'a pas retourné l'identifiant du plat.");
      return;
    }

    // Photo / couleur de secours
    let finalImageUrl: string | null = null;
    let finalColor: string | null = null;

    if (imageFile) {
      // La policy RLS INSERT du bucket dish-images exige un utilisateur admin
      // (auth.uid() non nul). Si la session a expiré / n'est plus attachée, la
      // requête Storage part en anonyme et Supabase renvoie une erreur RLS
      // trompeuse. On rafraîchit/valide la session AVANT l'upload et on donne un
      // message clair plutôt qu'une erreur "row-level security policy".
      const { data: sessionData } = await supabase.auth.getSession();
      // [DEBUG TEMPORAIRE — à retirer une fois la cause confirmée]
      const { data: userData } = await supabase.auth.getUser();
      const exp = sessionData.session?.expires_at;
      console.log(
        "[dish-images upload] auth.uid =",
        userData.user?.id ?? "NULL (anonyme)",
        "| session =",
        sessionData.session ? "présente" : "absente",
        exp ? `| expire dans ${Math.round((exp * 1000 - Date.now()) / 1000)}s` : "",
      );
      // [/DEBUG TEMPORAIRE]
      if (!sessionData.session || !userData.user) {
        toast.error("Session absente ou expirée — reconnectez-vous, puis réessayez l'upload.");
        return;
      }

      const extension = IMAGE_EXTENSION_BY_TYPE[imageFile.type] ?? "jpg";
      const path = `${itemId}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(DISH_IMAGES_BUCKET)
        .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }
      // Remplacement : supprimer l'ancien fichier du bucket APRÈS un upload réussi
      // de la nouvelle image (évite de perdre l'ancienne si l'upload échoue).
      if (originalImageUrl) {
        const oldPath = storagePathFromPublicUrl(originalImageUrl);
        if (oldPath) await supabase.storage.from(DISH_IMAGES_BUCKET).remove([oldPath]);
      }
      const { data: publicUrlData } = supabase.storage.from(DISH_IMAGES_BUCKET).getPublicUrl(path);
      finalImageUrl = publicUrlData.publicUrl;
      finalColor = null;
    } else if (itemForm.imageUrl) {
      // Image existante conservée telle quelle.
      finalImageUrl = itemForm.imageUrl;
      finalColor = null;
    } else {
      // Aucune image : couleur de secours, et suppression de l'ancien fichier le cas échéant.
      if (originalImageUrl) {
        const oldPath = storagePathFromPublicUrl(originalImageUrl);
        if (oldPath) await supabase.storage.from(DISH_IMAGES_BUCKET).remove([oldPath]);
      }
      finalImageUrl = null;
      finalColor = itemForm.color || DEFAULT_DISH_COLOR;
    }

    const { error: mediaError } = await supabase
      .from("menu_items")
      .update({ image_url: finalImageUrl, color: finalColor })
      .eq("id", itemId);
    if (mediaError) {
      toast.error(mediaError.message);
      return;
    }

    // Formats/prix : upsert des lignes présentes dans le formulaire, suppression de celles retirées.
    const keptIds = new Set(parsedSizes.map((s) => s.id).filter((id): id is string => Boolean(id)));
    const removedIds = originalSizes.map((s) => s.id).filter((id) => !keptIds.has(id));

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("menu_item_sizes")
        .delete()
        .in("id", removedIds);
      if (deleteError) {
        toast.error(deleteError.message);
        return;
      }
    }

    const upsertPayload = parsedSizes.map((s, index) => ({
      ...(s.id ? { id: s.id } : {}),
      menu_item_id: itemId,
      size_label: s.label,
      price: s.price,
      display_order: index + 1,
    }));

    const { error: upsertError } = await supabase.from("menu_item_sizes").upsert(upsertPayload);
    if (upsertError) {
      toast.error(upsertError.message);
      return;
    }

    // Options disponibles pour ce plat : remplace les associations existantes par la sélection actuelle.
    const { error: deleteLinksError } = await supabase
      .from("menu_item_option_groups")
      .delete()
      .eq("menu_item_id", itemId);
    if (deleteLinksError) {
      toast.error(deleteLinksError.message);
      return;
    }

    if (itemForm.optionGroupIds.length > 0) {
      const linksPayload = itemForm.optionGroupIds.map((groupId, index) => ({
        menu_item_id: itemId,
        option_group_id: groupId,
        display_order: index + 1,
      }));
      const { error: insertLinksError } = await supabase
        .from("menu_item_option_groups")
        .insert(linksPayload);
      if (insertLinksError) {
        toast.error(insertLinksError.message);
        return;
      }
    }

    toast.success(`Plat ${itemForm.id ? "mis à jour" : "créé"}`);
    setItemForm(null);
    loadMenu();
  }

  async function deleteItem(id: string) {
    if (!confirm("Supprimer ce plat ?")) return;
    const target = items.find((it) => it.id === id);
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Supprime aussi le fichier image correspondant dans le bucket dish-images.
    if (target?.image_url) {
      const path = storagePathFromPublicUrl(target.image_url);
      if (path) await supabase.storage.from(DISH_IMAGES_BUCKET).remove([path]);
    }
    toast.success("Plat supprimé.");
    loadMenu();
  }

  function openCategoryEditor(category?: CategoryRow) {
    setCategoryNameError(null);
    setCategoryForm(
      category
        ? {
            id: category.id,
            name: category.name,
          }
        : { name: "" },
    );
  }

  function resetImageState() {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  }

  function openItemEditor(item?: MenuItemRow) {
    resetImageState();
    setItemNameError(null);
    setOriginalImageUrl(item?.image_url ?? null);
    const existingSizes = item ? (sizesByItemId[item.id] ?? []) : [];
    setOriginalSizes(existingSizes);
    setItemForm(
      item
        ? {
            id: item.id,
            category_id: item.category_id,
            name: item.name,
            description: item.description ?? "",
            sizes:
              existingSizes.length > 0
                ? existingSizes.map((s) => ({
                    id: s.id,
                    label: s.size_label,
                    price: s.price.toString(),
                  }))
                : [{ label: "Standard", price: "" }],
            color: item.color ?? DEFAULT_DISH_COLOR,
            imageUrl: item.image_url ?? null,
            isFeatured: item.is_featured ?? false,
            optionGroupIds: groupIdsByItemId[item.id] ?? [],
          }
        : {
            category_id: selectedCategory?.id ?? "",
            name: "",
            description: "",
            sizes: [{ label: "Standard", price: "" }],
            color: DEFAULT_DISH_COLOR,
            imageUrl: null,
            isFeatured: false,
            optionGroupIds: [],
          },
    );
  }

  function toggleOptionGroup(groupId: string) {
    setItemForm((previous) => {
      if (!previous) return previous;
      const isSelected = previous.optionGroupIds.includes(groupId);
      return {
        ...previous,
        optionGroupIds: isSelected
          ? previous.optionGroupIds.filter((id) => id !== groupId)
          : [...previous.optionGroupIds, groupId],
      };
    });
  }

  function addSizeRow() {
    setItemForm((previous) =>
      previous ? { ...previous, sizes: [...previous.sizes, { label: "", price: "" }] } : previous,
    );
  }

  function removeSizeRow(index: number) {
    setItemForm((previous) => {
      if (!previous || previous.sizes.length <= 1) return previous;
      return { ...previous, sizes: previous.sizes.filter((_, i) => i !== index) };
    });
  }

  function updateSizeRow(index: number, patch: Partial<{ label: string; price: string }>) {
    setItemForm((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        sizes: previous.sizes.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      };
    });
  }

  // Seules les pizzas proposent plusieurs formats ; les autres catégories ont un prix fixe.
  function isPizzaCategoryId(categoryId: string): boolean {
    const category = categories.find((c) => c.id === categoryId);
    return (category?.name ?? "").trim().toLowerCase() === "pizzas";
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Format non autorisé. Utilisez JPEG, PNG ou WebP.");
      setImageFile(null);
      setImagePreview(null);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image trop lourde : 2 Mo maximum.");
      setImageFile(null);
      setImagePreview(null);
      event.target.value = "";
      return;
    }

    setImageError(null);
    setImageFile(file);
    setImagePreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    // Une nouvelle image remplace l'image existante éventuelle.
    setItemForm((previous) => (previous ? { ...previous, imageUrl: null } : previous));
  }

  async function removeSelectedImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    // Supprime le fichier courant du bucket dish-images, pas seulement le champ.
    if (originalImageUrl) {
      const path = storagePathFromPublicUrl(originalImageUrl);
      if (path) await supabase.storage.from(DISH_IMAGES_BUCKET).remove([path]);
      setOriginalImageUrl(null);
    }
    setItemForm((previous) => (previous ? { ...previous, imageUrl: null } : previous));
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Administration
            </p>
            <h2 className="text-2xl font-black">Menu</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openCategoryEditor()}>
              <Plus className="h-4 w-4" /> Nouvelle catégorie
            </Button>
            <Button
              variant="secondary"
              onClick={() => openItemEditor()}
              disabled={!selectedCategory}
            >
              <Plus className="h-4 w-4" /> Nouveau plat
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Catégories</p>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez une catégorie pour éditer ses plats.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {categories.length}
              </span>
            </div>
            <div className="space-y-2">
              {categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-input/70 p-8 text-center text-sm text-muted-foreground">
                  Aucune catégorie disponible.
                </div>
              ) : (
                categories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      selectedCategory?.id === category.id
                        ? "border-brand bg-brand/10"
                        : "border-input/80 bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{category.name}</div>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCategoryEditor(category);
                          }}
                          className="rounded-full p-2 hover:bg-muted"
                          aria-label="Éditer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteCategory(category.id);
                          }}
                          className="rounded-full p-2 text-destructive hover:bg-destructive/10"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* description removed from categories */}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Plats</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCategory
                    ? `Plats de la catégorie ${selectedCategory.name}`
                    : "Sélectionnez une catégorie."}
                </p>
              </div>
              <div className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {categoryItems.length}
              </div>
            </div>

            {selectedCategory ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead>Prix / Formats</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold">{item.name}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {item.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {formatSizes(
                          (sizesByItemId[item.id] ?? []).map((s) => ({
                            label: s.size_label,
                            price: s.price,
                          })),
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openItemEditor(item)}
                            className="rounded-full border p-2 hover:bg-muted"
                            aria-label="Éditer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="rounded-full border p-2 text-destructive hover:bg-destructive/10"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-3xl border border-dashed border-input/70 p-8 text-center text-sm text-muted-foreground">
                Sélectionnez une catégorie pour afficher ses plats.
              </div>
            )}
          </section>
        </div>

        {(categoryForm || itemForm) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[85vh] w-full max-w-[90vw] flex-col overflow-hidden rounded-3xl bg-card shadow-xl md:max-w-2xl">
              {categoryForm ? (
                <form onSubmit={saveCategory} className="flex min-h-0 flex-1 flex-col">
                  {/* Header sticky */}
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
                    <div>
                      <h2 className="text-xl font-black">
                        {categoryForm.id ? "Modifier la catégorie" : "Nouvelle catégorie"}
                      </h2>
                      <p className="text-sm text-muted-foreground">Gérez les catégories du menu.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCategoryForm(null)}
                      className="rounded-full border px-3 py-2 text-sm"
                    >
                      Fermer
                    </button>
                  </div>

                  {/* Corps scrollable */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold">Nom</label>
                      <Input
                        value={categoryForm.name}
                        onChange={(event) => {
                          setCategoryNameError(null);
                          setCategoryForm({
                            ...categoryForm,
                            name: event.target.value,
                          });
                        }}
                      />
                      {categoryNameError && (
                        <p className="mt-1 text-sm text-destructive">{categoryNameError}</p>
                      )}
                    </div>
                  </div>

                  {/* Footer sticky */}
                  <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
                    <Button variant="outline" type="button" onClick={() => setCategoryForm(null)}>
                      Annuler
                    </Button>
                    <Button type="submit">Enregistrer</Button>
                  </div>
                </form>
              ) : null}

              {itemForm ? (
                <form onSubmit={saveItem} className="flex min-h-0 flex-1 flex-col">
                  {/* Header sticky */}
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
                    <div>
                      <h2 className="text-xl font-black">
                        {itemForm.id ? "Modifier le plat" : "Nouveau plat"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Ajoutez ou mettez à jour un plat du menu.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setItemForm(null)}
                      className="rounded-full border px-3 py-2 text-sm"
                    >
                      Fermer
                    </button>
                  </div>

                  {/* Corps scrollable */}
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold">Catégorie</label>
                        <select
                          value={itemForm.category_id}
                          onChange={(event) => {
                            setItemNameError(null);
                            setItemForm({ ...itemForm, category_id: event.target.value });
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="" disabled>
                            Choisir une catégorie
                          </option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold">Nom du plat</label>
                        <Input
                          value={itemForm.name}
                          onChange={(event) => {
                            setItemNameError(null);
                            setItemForm({ ...itemForm, name: event.target.value });
                          }}
                        />
                        {itemNameError && (
                          <p className="mt-1 text-sm text-destructive">{itemNameError}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold">Description</label>
                      <Textarea
                        rows={2}
                        className="resize-y"
                        value={itemForm.description}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, description: event.target.value })
                        }
                        placeholder="Optionnel"
                      />
                    </div>

                    {/* Photo + Couleur de secours côte à côte */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold">Photo du plat</label>
                        <div className="flex items-start gap-3">
                          {imagePreview || itemForm.imageUrl ? (
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border">
                              <img
                                src={imagePreview ?? itemForm.imageUrl ?? undefined}
                                alt="Aperçu du plat"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed text-center text-[11px] text-muted-foreground"
                              style={{ backgroundColor: itemForm.color || DEFAULT_DISH_COLOR }}
                            >
                              Aucune photo
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <Input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleImageChange}
                            />
                            {(imagePreview || itemForm.imageUrl) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={removeSelectedImage}
                              >
                                <Trash2 className="h-4 w-4" /> Supprimer la photo
                              </Button>
                            )}
                            <p className="text-xs text-muted-foreground">
                              JPEG, PNG ou WebP — 2 Mo maximum.
                            </p>
                          </div>
                        </div>
                        {imageError && (
                          <p className="mt-2 text-sm text-destructive">{imageError}</p>
                        )}
                      </div>

                      {!imagePreview && !itemForm.imageUrl && (
                        <div>
                          <label className="mb-1 block text-sm font-semibold">
                            Couleur de secours
                          </label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="color"
                              value={itemForm.color || DEFAULT_DISH_COLOR}
                              onChange={(event) =>
                                setItemForm({ ...itemForm, color: event.target.value })
                              }
                              className="h-10 w-16 p-1"
                            />
                            <span className="font-mono text-xs text-muted-foreground">
                              {itemForm.color || DEFAULT_DISH_COLOR}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Affichée à la place de la photo si aucune image n'est ajoutée.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Prix + Options sur une ligne (3 colonnes) hors pizza */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      {isPizzaCategoryId(itemForm.category_id) ? (
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-sm font-semibold">Prix / Formats</label>
                          <div className="space-y-2">
                            {itemForm.sizes.map((size, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Input
                                  value={size.label}
                                  onChange={(event) =>
                                    updateSizeRow(index, { label: event.target.value })
                                  }
                                  placeholder="Ex. Moyenne"
                                  className="flex-1"
                                />
                                <Input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={size.price}
                                  onChange={(event) =>
                                    updateSizeRow(index, { price: event.target.value })
                                  }
                                  placeholder="Ex. 5.400"
                                  className="w-32"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSizeRow(index)}
                                  disabled={itemForm.sizes.length <= 1}
                                  className="rounded-full border p-2 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                                  aria-label="Supprimer ce format"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={addSizeRow}
                          >
                            <Plus className="h-4 w-4" /> Ajouter un format
                          </Button>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Plusieurs formats possibles (ex. « Moyenne », « Maxi »), chacun avec son
                            prix.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-sm font-semibold">Prix</label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={itemForm.sizes[0]?.price ?? ""}
                            onChange={(event) =>
                              updateSizeRow(0, { label: "Standard", price: event.target.value })
                            }
                            placeholder="Ex. 5.400"
                            className="w-full"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">Prix unique du plat.</p>
                        </div>
                      )}

                      <div
                        className={
                          isPizzaCategoryId(itemForm.category_id)
                            ? "sm:col-span-3"
                            : "sm:col-span-2"
                        }
                      >
                        <label className="mb-1 block text-sm font-semibold">
                          Options disponibles pour ce plat
                        </label>
                        {optionGroups.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Aucun groupe d'options disponible. Créez-en depuis la section « Options
                            ».
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {optionGroups.map((group) => (
                              <label
                                key={group.id}
                                className="flex items-center justify-between gap-2 rounded-lg border p-2"
                              >
                                <span className="text-sm font-medium">
                                  {group.name}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    ({group.type === "retirable" ? "Retirable" : "Supplément"})
                                  </span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={itemForm.optionGroupIds.includes(group.id)}
                                  onChange={() => toggleOptionGroup(group.id)}
                                  className="h-5 w-5 accent-brand"
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mise en avant — checkbox inline simple */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={itemForm.isFeatured}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, isFeatured: event.target.checked })
                        }
                        className="h-5 w-5 accent-brand"
                      />
                      <span className="text-sm font-semibold">
                        Mettre en avant dans « Plats populaires »
                      </span>
                    </label>
                  </div>

                  {/* Footer sticky */}
                  <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
                    <Button variant="outline" type="button" onClick={() => setItemForm(null)}>
                      Annuler
                    </Button>
                    <Button type="submit">Enregistrer</Button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
