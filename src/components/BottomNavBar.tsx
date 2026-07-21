"use client";

import React from "react";
import { Home, Search, ShoppingBag, User } from "lucide-react";

/*
  Composant BottomNavBar
  - Barre fixée en bas, adaptée pour mobile/PWA (safe-area-inset-bottom)
  - 4 onglets: Accueil, Explorer, Commandes, Compte
  - Onglet actif en couleur brand (#B22222), les autres en gris
  - N'utilise que des liens normaux pour rester indépendant du routeur
*/

const TABS: Array<{
  label: string;
  to: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { label: "Accueil", to: "/", Icon: Home },
  { label: "Commandes", to: "/commandes", Icon: ShoppingBag },
  { label: "Compte", to: "/compte", Icon: User },
];

export function BottomNavBar() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed left-0 right-0 bottom-0 z-[999] box-border w-full bg-white/95 backdrop-blur-md"
      style={{ height: 64, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-full max-w-xl items-center justify-between px-4">
        {TABS.map((t) => {
          const active = pathname === t.to;
          const colorClass = active ? "text-[#B22222]" : "text-neutral-500";
          const Icon = t.Icon;
          return (
            <a
              key={t.to}
              href={t.to}
              className={`flex flex-col items-center justify-center gap-1 text-xs ${colorClass} no-underline`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[12px]">{t.label}</span>
            </a>
          );
        })}
      </div>
      <style>{`\n        @supports(padding: env(safe-area-inset-bottom)) {\n          nav { padding-bottom: env(safe-area-inset-bottom); }\n        }\n      `}</style>
    </nav>
  );
}

export default BottomNavBar;
