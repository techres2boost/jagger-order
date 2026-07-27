import { Link } from "@tanstack/react-router";
import { MessageCircle, Bike } from "lucide-react";

interface DriverCardProps {
  orderId: string;
  nom: string;
  // Sous-titre statut/distance (ex. "En route vers vous").
  subtitle: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

// Carte du livreur assigné : avatar à initiales (la table `livreurs` n'a pas de
// photo), nom, statut, et bouton de messagerie rond renvoyant vers l'écran de
// suivi (carte + chat). Purement présentational : nom/statut passés en props.
export function DriverCard({ orderId, nom, subtitle }: DriverCardProps) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3 text-left">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {initials(nom)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Votre livreur
        </div>
        <div className="truncate text-base font-black">{nom}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bike className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
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
  );
}
