"use client";

import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, MessagesSquare } from "lucide-react";
import { DRIVER_ACTIVE_STATUSES } from "@/components/DriverOrders";

// Navbar globale du dashboard livreur : point d'entrée/routage vers les deux
// écrans (Commandes / Conversations). Barre fixée en bas, toujours visible, sur
// le modèle des navbars existantes de l'app (BottomNavBar).
export function DriverNavbar() {
  const location = useLocation();
  const [activeCount, setActiveCount] = useState(0);

  // Compteur de commandes actives (badge) : rafraîchi en Realtime sur les
  // commandes assignées à ce livreur.
  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!mounted || !u.user) return;
      const { data: livreur } = await supabase
        .from("livreurs")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!mounted || !livreur) return;

      const loadCount = async () => {
        const { count } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("assigned_livreur_id", livreur.id)
          .in("status", [...DRIVER_ACTIVE_STATUSES]);
        if (mounted) setActiveCount(count ?? 0);
      };
      await loadCount();

      channel = supabase
        .channel(`driver-navbar-${livreur.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `assigned_livreur_id=eq.${livreur.id}`,
          },
          () => loadCount(),
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const items = [
    { to: "/driver/orders", label: "Commandes", Icon: ClipboardList, badge: activeCount },
    { to: "/driver/conversations", label: "Conversations", Icon: MessagesSquare, badge: 0 },
  ] as const;

  return (
    <nav
      aria-label="Navigation livreur"
      className="fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav)] box-border w-full border-t bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-4">
        {items.map(({ to, label, Icon, badge }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-xs ${
                active ? "text-brand" : "text-neutral-500"
              }`}
            >
              <span className="relative">
                <Icon className="h-6 w-6" />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[12px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
