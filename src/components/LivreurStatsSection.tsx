import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bike } from "lucide-react";

interface LivreurStatsRow {
  livreur_id: string;
  nom: string;
  telephone: string;
  is_active: boolean;
  total_livraisons: number;
  livraisons_en_cours: number;
}

// Section réutilisable affichant les statistiques par livreur (vue livreur_stats).
// Utilisée comme carte dans le Dashboard admin.
export function LivreurStatsSection() {
  const [stats, setStats] = useState<LivreurStatsRow[]>([]);
  const [avgByLivreur, setAvgByLivreur] = useState<Record<string, { avg: number; count: number }>>(
    {},
  );

  useEffect(() => {
    supabase
      .from("livreur_stats")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        setStats((data as LivreurStatsRow[]) ?? []);
      });

    supabase
      .from("livreur_ratings")
      .select("livreur_id, rating")
      .not("livreur_id", "is", null)
      .not("rating", "is", null)
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        const acc: Record<string, { sum: number; count: number }> = {};
        (data ?? []).forEach((r) => {
          const id = r.livreur_id as string;
          const val = Number(r.rating);
          if (!id || !Number.isFinite(val)) return;
          acc[id] = { sum: (acc[id]?.sum ?? 0) + val, count: (acc[id]?.count ?? 0) + 1 };
        });
        const out: Record<string, { avg: number; count: number }> = {};
        Object.entries(acc).forEach(([id, v]) => {
          out[id] = { avg: v.sum / v.count, count: v.count };
        });
        setAvgByLivreur(out);
      });
  }, []);

  const best = stats
    .filter((s) => avgByLivreur[s.livreur_id])
    .sort(
      (a, b) =>
        avgByLivreur[b.livreur_id].avg - avgByLivreur[a.livreur_id].avg ||
        avgByLivreur[b.livreur_id].count - avgByLivreur[a.livreur_id].count,
    )[0];

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide">
        <span className="text-brand">
          <Bike className="h-5 w-5" />
        </span>{" "}
        Statistiques livreurs
      </h2>

      {best && (
        <div className="mb-4 rounded-3xl border-2 border-[#F5B800] bg-[#F5B800]/10 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-brand">
            <Star className="h-4 w-4 fill-[#F5B800] text-[#F5B800]" /> Livreur le mieux noté
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-black">{best.nom}</div>
              <div className="text-xs text-muted-foreground">{best.telephone}</div>
            </div>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                best.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {best.is_active ? "Actif" : "Inactif"}
            </span>
          </div>
          <div className="mt-4 text-3xl font-black text-brand">
            {avgByLivreur[best.livreur_id].avg.toFixed(1).replace(".", ",")}★
          </div>
          <div className="text-xs text-muted-foreground">
            Note moyenne · {avgByLivreur[best.livreur_id].count} avis
          </div>
        </div>
      )}

      {stats.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun livreur enregistré.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.livreur_id} className="rounded-3xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black">{s.nom}</div>
                  <div className="text-xs text-muted-foreground">{s.telephone}</div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                    s.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.is_active ? "Actif" : "Inactif"}
                </span>
              </div>
              <div className="mt-4 text-3xl font-black text-brand">{s.total_livraisons}</div>
              <div className="text-xs text-muted-foreground">Livraisons totales</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
