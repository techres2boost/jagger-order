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
import { Edit3, Plus, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/livreurs")({
  ssr: false,
  component: AdminLivreursPage,
});

interface LivreurRow {
  id: string;
  user_id: string | null;
  nom: string;
  telephone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface LivreurStatsRow {
  livreur_id: string;
  total_livraisons: number;
  livraisons_en_cours: number;
}

interface LivreurFormState {
  id?: string;
  nom: string;
  telephone: string;
  email: string;
}

function AdminLivreursPage() {
  const [livreurs, setLivreurs] = useState<LivreurRow[]>([]);
  const [statsByLivreurId, setStatsByLivreurId] = useState<Record<string, LivreurStatsRow>>({});
  const [form, setForm] = useState<LivreurFormState | null>(null);

  useEffect(() => {
    loadLivreurs();
  }, []);

  async function loadLivreurs() {
    const [{ data: livreursData, error: livreursError }, { data: statsData, error: statsError }] =
      await Promise.all([
        supabase.from("livreurs").select("*").order("created_at", { ascending: true }),
        supabase.from("livreur_stats").select("*"),
      ]);

    if (livreursError) {
      toast.error(livreursError.message);
      return;
    }
    if (statsError) {
      toast.error(statsError.message);
      return;
    }

    setLivreurs((livreursData as LivreurRow[]) ?? []);
    const map: Record<string, LivreurStatsRow> = {};
    (statsData as LivreurStatsRow[] | null)?.forEach((s) => {
      map[s.livreur_id] = s;
    });
    setStatsByLivreurId(map);
  }

  async function saveLivreur(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;

    if (!form.nom.trim() || !form.telephone.trim() || !form.email.trim()) {
      toast.error("Nom, téléphone et email sont requis.");
      return;
    }

    const values = {
      id: form.id,
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
    };

    const { error } = await supabase.from("livreurs").upsert(values);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Livreur ${form.id ? "mis à jour" : "ajouté"}`);
    setForm(null);
    loadLivreurs();
  }

  async function toggleActive(livreur: LivreurRow) {
    const { error } = await supabase
      .from("livreurs")
      .update({ is_active: !livreur.is_active })
      .eq("id", livreur.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(livreur.is_active ? "Livreur désactivé" : "Livreur activé");
    loadLivreurs();
  }

  function openEditor(livreur?: LivreurRow) {
    setForm(
      livreur
        ? { id: livreur.id, nom: livreur.nom, telephone: livreur.telephone, email: livreur.email }
        : { nom: "", telephone: "", email: "" },
    );
  }

  const sortedLivreurs = useMemo(
    () => [...livreurs].sort((a, b) => a.nom.localeCompare(b.nom)),
    [livreurs],
  );

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Administration
            </p>
            <h2 className="text-2xl font-black">Livreurs</h2>
          </div>
          <Button variant="secondary" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" /> Ajouter un livreur
          </Button>
        </div>

        <section className="rounded-3xl border bg-card p-4 shadow-sm">
          {sortedLivreurs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-input/70 p-8 text-center text-sm text-muted-foreground">
              Aucun livreur enregistré.
            </div>
          ) : (
            <>
              {/* Vue desktop : tableau */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Livraisons</TableHead>
                      <TableHead>En cours</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLivreurs.map((livreur) => {
                      const stats = statsByLivreurId[livreur.id];
                      return (
                        <TableRow key={livreur.id}>
                          <TableCell>
                            <div className="font-semibold">{livreur.nom}</div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                                livreur.is_active
                                  ? "bg-success/20 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {livreur.is_active ? "Actif" : "Inactif"}
                            </span>
                          </TableCell>
                          <TableCell>{stats?.total_livraisons ?? 0}</TableCell>
                          <TableCell>{stats?.livraisons_en_cours ?? 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditor(livreur)}
                                className="rounded-full border p-2 hover:bg-muted"
                                aria-label="Éditer"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(livreur)}
                                className={`rounded-full border p-2 hover:bg-muted ${
                                  livreur.is_active ? "text-destructive" : "text-success"
                                }`}
                                aria-label={livreur.is_active ? "Désactiver" : "Activer"}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Vue mobile : cartes empilées */}
              <div className="grid gap-3 md:hidden">
                {sortedLivreurs.map((livreur) => {
                  const stats = statsByLivreurId[livreur.id];
                  return (
                    <div key={livreur.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{livreur.nom}</div>
                        </div>
                        <span
                          className={`shrink-0 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                            livreur.is_active
                              ? "bg-success/20 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {livreur.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground">Livraisons</div>
                          <div className="font-black">{stats?.total_livraisons ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-2">
                          <div className="text-xs text-muted-foreground">En cours</div>
                          <div className="font-black">{stats?.livraisons_en_cours ?? 0}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditor(livreur)}
                          className="rounded-full border p-2 hover:bg-muted"
                          aria-label="Éditer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(livreur)}
                          className={`rounded-full border p-2 hover:bg-muted ${
                            livreur.is_active ? "text-destructive" : "text-success"
                          }`}
                          aria-label={livreur.is_active ? "Désactiver" : "Activer"}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {form && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-[90vw] rounded-3xl bg-card p-6 shadow-xl md:max-w-lg">
              <form onSubmit={saveLivreur} className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black">
                      {form.id ? "Modifier le livreur" : "Ajouter un livreur"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      L'email doit correspondre à celui utilisé par le livreur pour se connecter via
                      Google.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(null)}
                    className="rounded-full border px-3 py-2 text-sm"
                  >
                    Fermer
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Nom</label>
                  <Input
                    value={form.nom}
                    onChange={(event) => setForm({ ...form, nom: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Téléphone</label>
                  <Input
                    value={form.telephone}
                    onChange={(event) => setForm({ ...form, telephone: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Email</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={() => setForm(null)}>
                    Annuler
                  </Button>
                  <Button type="submit">Enregistrer</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
