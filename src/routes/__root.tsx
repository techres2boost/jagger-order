import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "../lib/cart-context";
import { ThemeProvider } from "../lib/theme-context";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import BottomNavBar from "@/components/BottomNavBar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-brand">404</h1>
        <h2 className="mt-4 text-xl font-bold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <a
            href="/app"
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:opacity-90"
          >
            Retour au menu
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Réessayez ou revenez au menu.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="h-11 rounded-full bg-brand px-6 text-sm font-semibold text-brand-foreground hover:opacity-90"
          >
            Réessayer
          </button>
          <a
            href="/app"
            className="h-11 inline-flex items-center rounded-full border px-6 text-sm font-semibold"
          >
            Menu
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { title: "Jagger — Menu, commande & livraison" },
      {
        name: "description",
        content:
          "Consultez le menu de Jagger (cafés, crêpes, gaufres, pancakes, pasta, salades) et commandez en livraison ou à retirer sur place.",
      },
      { name: "author", content: "Jagger" },
      { property: "og:title", content: "Jagger — Menu, commande & livraison" },
      {
        property: "og:description",
        content:
          "Consultez le menu de Jagger (cafés, crêpes, gaufres, pancakes, pasta, salades) et commandez en livraison ou à retirer sur place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Jagger — Menu, commande & livraison" },
      {
        name: "twitter:description",
        content:
          "Consultez le menu de Jagger (cafés, crêpes, gaufres, pancakes, pasta, salades) et commandez en livraison ou à retirer sur place.",
      },
      { property: "og:image", content: "/favicon.png" },
      { name: "twitter:image", content: "/favicon.png" },
      { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
      // CSP : source de vérité UNIQUE dans src/server.ts (en-tête HTTP + nonce par
      // requête). La meta http-equiv redondante a été retirée (audit #2).
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Splash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
      <div className="brand-splash-stage" style={{ perspective: "800px" }}>
        <div className="brand-splash-intro">
          <div className="brand-splash-spin">
            <BrandLogo size={140} />
          </div>
        </div>
      </div>
      <div className="brand-splash-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <style>{`
        .brand-splash-stage { display: flex; align-items: center; justify-content: center; }
        .brand-splash-intro {
          animation: brandIntro 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: transform, opacity;
        }
        @keyframes brandIntro {
          0%   { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        .brand-splash-spin {
          transform-style: preserve-3d;
          animation: brandSpin 3.6s ease-in-out 700ms infinite;
          will-change: transform;
        }
        @keyframes brandSpin {
          0%   { transform: rotateY(-14deg); }
          50%  { transform: rotateY(14deg); }
          100% { transform: rotateY(-14deg); }
        }
        .brand-splash-dots {
          position: absolute;
          bottom: 3rem;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 0.5rem;
        }
        .brand-splash-dots span {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: var(--color-brand, #1a1a1a);
          opacity: 0.3;
          animation: brandDot 1.2s ease-in-out infinite;
        }
        .brand-splash-dots span:nth-child(2) { animation-delay: 0.15s; }
        .brand-splash-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes brandDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40%           { opacity: 1;    transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    import("@/lib/push").then((m) => m.registerServiceWorker());
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function determineNavVisibility() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!isMounted) return;
      if (!user?.id) {
        setShowBottomNav(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!isMounted) return;
      // La bottom nav (Accueil / Commandes / Compte) est réservée aux clients.
      // On la masque pour le staff : admin ET livreur.
      const roleValues = (roles ?? []).map((r) => r.role);
      const isStaff = roleValues.includes("admin") || roleValues.includes("livreur");
      setShowBottomNav(!isStaff);
    }

    determineNavVisibility();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        determineNavVisibility();
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          {showSplash && <Splash />}
          <Outlet />
          {showBottomNav && <BottomNavBar />}
          <Toaster position="top-center" richColors />
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
