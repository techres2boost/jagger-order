import { Link } from "@tanstack/react-router";
import { MessageCircle, Bike } from "lucide-react";
import { fmt } from "@/lib/format";

interface DriverCardProps {
  orderId: string;
  nom: string;
  // Sous-titre statut/distance (ex. "En route vers vous").
  subtitle: string;
  // Récap des items (ex. "2× Big Cheese, 1× Coca-Cola") + total, affichés dans la carte.
  itemsLabel: string;
  total: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

// Carte du livreur assigné : avatar à initiales (la table `livreurs` n'a pas de
// photo), "Prénom · votre livreur", sous-titre statut, bouton de messagerie rond
// vers l'écran de suivi (carte + chat), puis récap des items + prix dans la même
// carte. Purement présentational : toutes les données arrivent en props.
export function DriverCard({ orderId, nom, subtitle, itemsLabel, total }: DriverCardProps) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-left">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {initials(nom)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">
            <span className="font-black capitalize">{firstName(nom)}</span>
            <span className="text-muted-foreground"> · votre livreur</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bike className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
            <span className="truncate">{subtitle}</span>
          </div>
        </div>
        <Link
          to="/orders/$orderId/tracking"
          params={{ orderId }}
          aria-label="Envoyer un message au livreur"
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>
      </div>

      {itemsLabel && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {itemsLabel}
          </span>
          <span className="shrink-0 text-sm font-black text-brand">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
