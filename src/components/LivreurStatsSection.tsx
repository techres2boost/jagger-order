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
  }, []);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide">
        <span className="text-brand">
          <Bike className="h-5 w-5" />
        </span>{" "}
        Statistiques livreurs
      </h2>

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
