import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Edit3, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/options")({
  ssr: false,
  component: AdminOptionsPage,
});

type OptionGroupType = "retirable" | "supplement";

interface OptionGroupRow {
  id: string;
  name: string;
  type: OptionGroupType;
  max_selection: number;
  display_order: number;
  created_at: string;
}

interface OptionItemRow {
  id: string;
  group_id: string;
  name: string;
  price: number;
  display_order: number;
  created_at: string;
}

interface GroupFormState {
  id?: string;
  name: string;
  type: OptionGroupType;
  max_selection: string;
}

interface ItemFormState {
  id?: string;
  name: string;
  price: string;
}

const TYPE_LABEL: Record<OptionGroupType, string> = {
  retirable: "Retirable (gratuit)",
  supplement: "Supplément (payant)",
};

function AdminOptionsPage() {
  const [groups, setGroups] = useState<OptionGroupRow[]>([]);
  const [items, setItems] = useState<OptionItemRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );

  const groupItems = useMemo(
    () => items.filter((i) => i.group_id === selectedGroup?.id),
    [items, selectedGroup],
  );

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  async function loadOptions() {
    setLoading(true);
    const [{ data: groupsData, error: groupsError }, { data: itemsData, error: itemsError }] =
      await Promise.all([
        supabase.from("option_groups").select("*").order("display_order", { ascending: true }),
        supabase.from("option_items").select("*").order("display_order", { ascending: true }),
      ]);
    setLoading(false);

    if (groupsError) {
      toast.error(groupsError.message);
      return;
    }
    if (itemsError) {
      toast.error(itemsError.message);
      return;
    }

    setGroups((groupsData as OptionGroupRow[]) ?? []);
    setItems((itemsData as OptionItemRow[]) ?? []);
  }

  async function saveGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!groupForm) return;

    if (!groupForm.name.trim()) {
      toast.error("Le nom du groupe est requis.");
      return;
    }

    const maxSelection = Number(groupForm.max_selection);
    if (!groupForm.max_selection.trim() || Number.isNaN(maxSelection) || maxSelection < 1) {
      toast.error("Le nombre maximum de sélections doit être un entier positif.");
      return;
    }

    const values = {
      id: groupForm.id,
      name: groupForm.name.trim(),
      type: groupForm.type,
      max_selection: Math.floor(maxSelection),
      display_order: groupForm.id
        ? groups.find((g) => g.id === groupForm.id)?.display_order
        : groups.length + 1,
    };

    const { error } = await supabase.from("option_groups").upsert(values);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Groupe ${groupForm.id ? "mis à jour" : "créé"}`);
    setGroupForm(null);
    loadOptions();
  }

  async function deleteGroup(id: string) {
    if (!confirm("Supprimer ce groupe et tous ses items ?")) return;
    const { error } = await supabase.from("option_groups").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Groupe supprimé.");
    if (selectedGroupId === id) setSelectedGroupId(null);
    loadOptions();
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!itemForm || !selectedGroup) return;

    if (!itemForm.name.trim()) {
      toast.error("Le nom de l'item est requis.");
      return;
    }

    const isRetirable = selectedGroup.type === "retirable";
    const priceValue = isRetirable ? 0 : Number(itemForm.price.replace(",", "."));
    if (!isRetirable && (Number.isNaN(priceValue) || priceValue < 0)) {
      toast.error("Prix invalide.");
      return;
    }

    const values = {
      id: itemForm.id,
      group_id: selectedGroup.id,
      name: itemForm.name.trim(),
      price: priceValue,
      display_order: itemForm.id
        ? items.find((i) => i.id === itemForm.id)?.display_order
        : groupItems.length + 1,
    };

    const { error } = await supabase.from("option_items").upsert(values);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Item ${itemForm.id ? "mis à jour" : "créé"}`);
    setItemForm(null);
    loadOptions();
  }

  async function deleteItem(id: string) {
    if (!confirm("Supprimer cet item ?")) return;
    const { error } = await supabase.from("option_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Item supprimé.");
    loadOptions();
  }

  function openGroupEditor(group?: OptionGroupRow) {
    setGroupForm(
      group
        ? {
            id: group.id,
            name: group.name,
            type: group.type,
            max_selection: group.max_selection.toString(),
          }
        : { name: "", type: "retirable", max_selection: "1" },
    );
  }

  function openItemEditor(item?: OptionItemRow) {
    setItemForm(
      item
        ? { id: item.id, name: item.name, price: item.price.toString() }
        : { name: "", price: "0" },
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Administration
            </p>
            <h2 className="text-2xl font-black">Options</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openGroupEditor()}>
              <Plus className="h-4 w-4" /> Nouveau groupe
            </Button>
            <Button variant="secondary" onClick={() => openItemEditor()} disabled={!selectedGroup}>
              <Plus className="h-4 w-4" /> Nouvel item
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Groupes d'options</p>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez un groupe pour éditer ses items.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {groups.length}
              </span>
            </div>
            <div className="space-y-2">
              {groups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-input/70 p-8 text-center text-sm text-muted-foreground">
                  Aucun groupe disponible.
                </div>
              ) : (
                groups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      selectedGroup?.id === group.id
                        ? "border-brand bg-brand/10"
                        : "border-input/80 bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{group.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {TYPE_LABEL[group.type]} · max {group.max_selection}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openGroupEditor(group);
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
                            deleteGroup(group.id);
                          }}
                          className="rounded-full p-2 text-destructive hover:bg-destructive/10"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Items</p>
                <p className="text-xs text-muted-foreground">
                  {selectedGroup
                    ? `Items du groupe ${selectedGroup.name}`
                    : "Sélectionnez un groupe."}
                </p>
              </div>
              <div className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {groupItems.length}
              </div>
            </div>

            {selectedGroup ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold">{item.name}</div>
                      </TableCell>
                      <TableCell>
                        {selectedGroup.type === "supplement" ? `${item.price.toFixed(3)} TND` : "—"}
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
                Sélectionnez un groupe pour afficher ses items.
              </div>
            )}
          </section>
        </div>

        {(groupForm || itemForm) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-card p-6 shadow-xl">
              {groupForm ? (
                <form onSubmit={saveGroup} className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">
                        {groupForm.id ? "Modifier le groupe" : "Nouveau groupe"}
                      </h2>
                      <p className="text-sm text-muted-foreground">Gérez les groupes d'options.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGroupForm(null)}
                      className="rounded-full border px-3 py-2 text-sm"
                    >
                      Fermer
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">Nom</label>
                    <Input
                      value={groupForm.name}
                      onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
                      placeholder="Ex. Suppléments"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Type</label>
                      <select
                        value={groupForm.type}
                        onChange={(event) =>
                          setGroupForm({
                            ...groupForm,
                            type: event.target.value as OptionGroupType,
                          })
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="retirable">Retirable (gratuit)</option>
                        <option value="supplement">Supplément (payant)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Sélection max</label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={groupForm.max_selection}
                        onChange={(event) =>
                          setGroupForm({ ...groupForm, max_selection: event.target.value })
                        }
                        placeholder="Ex. 3"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setGroupForm(null)}>
                      Annuler
                    </Button>
                    <Button type="submit">Enregistrer</Button>
                  </div>
                </form>
              ) : null}

              {itemForm && selectedGroup ? (
                <form onSubmit={saveItem} className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">
                        {itemForm.id ? "Modifier l'item" : "Nouvel item"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Groupe : {selectedGroup.name} ({TYPE_LABEL[selectedGroup.type]})
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

                  <div>
                    <label className="mb-2 block text-sm font-semibold">Nom</label>
                    <Input
                      value={itemForm.name}
                      onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
                      placeholder={
                        selectedGroup.type === "retirable" ? "Ex. Sans Oignons" : "Ex. Bacon"
                      }
                    />
                  </div>

                  {selectedGroup.type === "supplement" && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Prix</label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={itemForm.price}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, price: event.target.value })
                        }
                        placeholder="Ex. 4.500"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
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
