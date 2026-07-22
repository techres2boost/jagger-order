"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { Home, Search, ShoppingBag, User } from "lucide-react";

// useLayoutEffect côté client, useEffect en SSR (évite l'avertissement React).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  const navRef = useRef<HTMLElement | null>(null);

  // On publie la hauteur réelle de la barre dans --bottom-nav-height, mesurée
  // dynamiquement (ResizeObserver) pour rester juste sur tous les appareils.
  // Les surfaces qui doivent la dégager (modale produit) lisent cette variable.
  useIsomorphicLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const applyHeight = () => {
      root.style.setProperty("--bottom-nav-height", `${el.getBoundingClientRect().height}px`);
    };
    applyHeight();
    const ro = new ResizeObserver(applyHeight);
    ro.observe(el);
    window.addEventListener("resize", applyHeight);
    window.addEventListener("orientationchange", applyHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", applyHeight);
      window.removeEventListener("orientationchange", applyHeight);
      // La barre est démontée (staff, page sans nav) : plus aucun dégagement.
      root.style.setProperty("--bottom-nav-height", "0px");
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Navigation principale"
      className="fixed left-0 right-0 bottom-0 z-[var(--z-bottom-nav)] box-border w-full bg-white/95 backdrop-blur-md"
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
