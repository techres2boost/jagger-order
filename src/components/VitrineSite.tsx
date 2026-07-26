import { Link, useNavigate } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Menu as MenuIcon,
  X,
  Search,
  ArrowRight,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  ChevronDown,
  MapPin,
  Truck,
  UtensilsCrossed,
  Navigation,
  Phone,
} from "lucide-react";
import { fmt } from "@/lib/format";
import { RESTAURANT_LOCATION, DELIVERY_RADIUS_KM } from "@/lib/geo";
import { useVitrineMenu, type VitrineItem } from "@/lib/vitrine-data";
import { VitrineMap } from "@/components/VitrineMap";
import vitrineHero from "@/assets/vitrine-hero.jpg";
import vitrineAbout from "@/assets/vitrine-about.jpg";
import vitrineCta from "@/assets/vitrine-cta.jpg";

const PHONE_DISPLAY = "54 338 753";
const PHONE_TEL = "+21654338753";

// Best Sellers — 3 paires avant/après hébergées sur GitHub (raw).
const GH_RAW = "https://raw.githubusercontent.com/techres2boost/box-bite-order/main/images";
const BEST_SELLERS_PAIRS = [
  { id: "big-cheese", name: "Big Cheese Burger", before: `${GH_RAW}/BigCheeseBurger_old.png`, after: `${GH_RAW}/BigCheeseBurger.png` },
  { id: "kabeb", name: "Kabeb", before: `${GH_RAW}/kebeb_old.png`, after: `${GH_RAW}/kabeb.png` },
  { id: "nuggets", name: "Nuggets", before: `${GH_RAW}/nuggets_old.png`, after: `${GH_RAW}/nuggets.png` },
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Site vitrine BOX — route publique racine ("/").
// Ne modifie AUCUNE logique de l'app : lit les mêmes données Supabase et
// renvoie vers l'app de commande (route "/app") par navigation interne.
// Palette stricte : blanc #FFFFFF, rouge #D40000, noir #0A0A0A.
// ─────────────────────────────────────────────────────────────────────────

const RED = "#D40000";
const DIRECTIONS_URL = "https://maps.app.goo.gl/Csqubno1QwEvnAbw7";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── Bouton « Commander » réutilisable (forme/hauteur/comportement communs) ──
// Toujours une navigation interne vers l'app de commande (jamais tel:).
function OrderButton({
  children = "Commander",
  size = "md",
  variant = "solid",
  className = "",
  withIcon = true,
}: {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "outline";
  className?: string;
  withIcon?: boolean;
}) {
  const h =
    size === "lg"
      ? "h-14 px-8 text-base"
      : size === "sm"
        ? "h-10 px-4 text-sm"
        : "h-12 px-6 text-sm";
  const base =
    variant === "solid"
      ? "text-white bx-btn-solid"
      : "text-white border border-white/25 bg-white/5 hover:bg-white/10";
  return (
    <Link
      to="/app"
      className={`bx-btn group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl font-extrabold uppercase tracking-wide ${h} ${base} ${className}`}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
        {withIcon && <ShoppingCart className="h-4 w-4" strokeWidth={2.5} />}
      </span>
    </Link>
  );
}

// ── Hook révélation au scroll (fade-up / scale) via IntersectionObserver ────
function useRevealRoot<T extends HTMLElement>(rootRef: RefObject<T | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (prefersReducedMotion()) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

// ── Compteur progressif ─────────────────────────────────────────────────
function CountUp({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(eased * value));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.6 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{display}</span>;
}

// ── Écran de chargement (joué une fois par session) ─────────────────────
function VitrineIntro() {
  const [gone, setGone] = useState(false);
  const [skip, setSkip] = useState(true);

  useEffect(() => {
    const already = sessionStorage.getItem("box_vitrine_intro");
    if (already || prefersReducedMotion()) {
      setGone(true);
      return;
    }
    setSkip(false);
    sessionStorage.setItem("box_vitrine_intro", "1");
    const t = setTimeout(() => setGone(true), 1900);
    return () => clearTimeout(t);
  }, []);

  if (skip || gone) return null;

  return (
    <div className="bx-intro" aria-hidden="true">
      <div className="bx-intro-word">
        {["B", "O", "X"].map((l, i) => (
          <span key={i} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>
            {l}
          </span>
        ))}
      </div>
      <div className="bx-intro-wipe" />
    </div>
  );
}

// ── Bouton d'action flottant persistant + bulle dismissible ─────────────
function FloatingOrder() {
  const [showBubble, setShowBubble] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem("box_vitrine_bubble") === "closed") {
      dismissed.current = true;
      return;
    }
    const onScroll = () => {
      if (!dismissed.current && window.scrollY > 260) {
        setShowBubble(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeBubble = useCallback(() => {
    dismissed.current = true;
    setShowBubble(false);
    sessionStorage.setItem("box_vitrine_bubble", "closed");
  }, []);

  return (
    <div className="fixed bottom-5 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {showBubble && (
        <div className="bx-bubble relative max-w-[220px] rounded-2xl bg-white px-4 py-3 pr-8 text-[13px] font-semibold text-[#0A0A0A] shadow-2xl">
          Une petite faim ? Votre commande vous attend, chaud devant.
          <button
            onClick={closeBubble}
            aria-label="Fermer"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-black/50 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Link
        to="/app"
        className="bx-float bx-btn bx-btn-solid group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full px-6 font-extrabold uppercase tracking-wide text-white shadow-2xl"
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          On a faim
          <ShoppingCart className="h-5 w-5" strokeWidth={2.5} />
        </span>
      </Link>
    </div>
  );
}

// ── Navbar sticky ────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: "#best-sellers", label: "Best Sellers" },
  { href: "#menu", label: "Menu" },
  { href: "#apropos", label: "À Propos" },
  { href: "#localisation", label: "Localisation" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bx-nav-scrolled" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="#top" className="bx-wordmark text-2xl text-white sm:text-[26px]">
          BOX
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-bold uppercase tracking-wide text-white/80 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <OrderButton size="sm" className="hidden sm:inline-flex" />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {open && (
        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-[#0A0A0A]/95 p-3 backdrop-blur md:hidden">
          <nav className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide text-white/85 hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <OrderButton size="md" className="mt-2 w-full" />
          </nav>
        </div>
      )}
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────
function Hero({ productCount, categoryCount }: { productCount: number; categoryCount: number }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const onScroll = () => setOffset(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#0A0A0A]"
    >
      {/* Fond hero : composition IA cinématique noir/rouge, léger parallax */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(0, ${offset * 0.25}px, 0) scale(1.1)`,
          backgroundImage: `url(${vitrineHero})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />


      <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-6">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/80">
          Fast-food gourmet
        </p>
        <h1 className="bx-hero-title max-w-3xl text-[15vw] leading-[0.92] text-white sm:text-7xl md:text-8xl">
          L'APPÉTIT
          <br />
          AVANT TOUT
        </h1>
        <p className="mt-5 max-w-xl text-base font-medium text-white/75 sm:text-lg">
          Sandwichs, burgers, pizzas et boissons — préparés généreux, servis chaud. Chez Box, on ne
          fait pas semblant d'avoir faim.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <OrderButton size="lg">Commander</OrderButton>
          <a
            href={DIRECTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 px-7 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-white/10"
          >
            <Navigation className="h-4 w-4" strokeWidth={2.5} />
            Itinéraire
          </a>
        </div>

        {/* Statistiques dynamiques (calculées depuis Supabase) */}
        <div className="mt-12 flex gap-10">
          <div>
            <div className="bx-wordmark text-4xl text-white sm:text-5xl" style={{ color: RED }}>
              <CountUp value={productCount} />
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/60">
              Produits à la carte
            </div>
          </div>
          <div>
            <div className="bx-wordmark text-4xl text-white sm:text-5xl" style={{ color: RED }}>
              <CountUp value={categoryCount} />
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-white/60">
              Catégories gourmandes
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Séparateur vague hero → best sellers ────────────────────────────────
function WaveDivider() {
  return (
    <div className="relative -mt-px h-16 bg-[#0A0A0A] sm:h-24" aria-hidden="true">
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
      >
        <path
          className="bx-wave"
          d="M0,64 C240,120 480,20 720,52 C960,84 1200,120 1440,60 L1440,120 L0,120 Z"
          fill="#D40000"
        />
        <path
          d="M0,80 C240,130 480,40 720,68 C960,96 1200,130 1440,76 L1440,120 L0,120 Z"
          fill="#0A0A0A"
          opacity="0.35"
        />
      </svg>
    </div>
  );
}

// ── Best Sellers ─────────────────────────────────────────────────────────
// Trois paires de photos avant/après, hébergées sur GitHub (URLs brutes).
function BeforeAfter({ before, after, name }: { before: string; after: string; name: string }) {
  const [pos, setPos] = useState(55);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(2, Math.min(98, p)));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const x = "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX;
      update(x);
    };
    const onUp = () => (dragging.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [update]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full overflow-hidden select-none touch-none bg-[#0A0A0A]"
      onMouseDown={(e) => {
        dragging.current = true;
        update(e.clientX);
      }}
      onTouchStart={(e) => {
        dragging.current = true;
        update(e.touches[0]?.clientX ?? 0);
      }}
    >
      {/* Avant (fond) */}
      <img src={before} alt={`${name} — avant`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {/* Étiquette AVANT */}
      <span className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white/90">
        Avant
      </span>

      {/* Après (clip par curseur) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={after} alt={`${name} — après`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <span className="absolute right-3 top-3 z-10 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-lg" style={{ background: RED }}>
          Après
        </span>
      </div>

      {/* Poignée */}
      <div className="absolute inset-y-0 z-20 flex items-center" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
        <div className="h-full w-[2px] bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
        <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/95 shadow-2xl" style={{ color: RED }}>
          <ArrowRight className="h-4 w-4 -mr-1" strokeWidth={3} />
          <ArrowRight className="h-4 w-4 rotate-180 -ml-1" strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}

function BestSellers() {
  return (
    <section id="best-sellers" className="bg-[#D40000] pb-20 pt-4 sm:pb-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div data-reveal className="bx-reveal mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">
            Les incontournables
          </p>
          <h2 className="bx-section-title mt-2 text-4xl text-white sm:text-6xl">
            Nos Stars du Menu
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80">
            Glissez la poignée pour voir la transformation « avant / après ».
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BEST_SELLERS_PAIRS.map((it, i) => (
            <article
              key={it.id}
              data-reveal
              className={`bx-reveal group relative overflow-hidden rounded-3xl bg-[#0A0A0A] ${
                i % 3 === 1 ? "lg:mt-8" : ""
              }`}
              style={{ transitionDelay: `${(i % 3) * 80}ms` }}
            >
              <BeforeAfter before={it.before} after={it.after} name={it.name} />
              <div className="flex items-center justify-between gap-3 p-5">
                <h3 className="bx-wordmark text-2xl text-white">{it.name}</h3>
                <OrderButton size="sm" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


// ── Menu (onglets + recherche + tri) ─────────────────────────────────────
function MenuSection({
  categories,
  items,
}: {
  categories: { id: string; name: string }[];
  items: VitrineItem[];
}) {
  const [active, setActive] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"none" | "asc" | "desc">("none");

  const filtered = useMemo(() => {
    let list = active === "__all__" ? items : items.filter((i) => i.categoryId === active);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q),
      );
    }
    if (sort !== "none") {
      const priceOf = (i: VitrineItem) => i.priceFrom ?? Number.POSITIVE_INFINITY;
      list = [...list].sort((a, b) =>
        sort === "asc" ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a),
      );
    }
    return list;
  }, [items, active, search, sort]);

  return (
    <section id="menu" className="bg-[#0A0A0A] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div data-reveal className="bx-reveal mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: RED }}>
            La carte complète
          </p>
          <h2 className="bx-section-title bx-glow mt-2 text-4xl text-white sm:text-6xl">Le Menu</h2>
        </div>

        {/* Recherche sticky */}
        <div className="sticky top-16 z-20 -mx-1 mb-5 bg-[#0A0A0A]/90 px-1 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un plat…"
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-10 text-sm font-medium text-white placeholder:text-white/40 focus:border-white/25 focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Effacer"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/50 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none"))}
              aria-label="Trier par prix"
              title="Trier par prix"
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-white ${
                sort === "none"
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-transparent bx-btn-solid"
              }`}
            >
              {sort === "desc" ? (
                <ArrowDownWideNarrow className="h-5 w-5" />
              ) : (
                <ArrowUpNarrowWide className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Onglets défilables */}
          <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {[{ id: "__all__", name: "Tout" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`shrink-0 snap-start rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                  active === c.id
                    ? "bx-btn-solid text-white"
                    : "border border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Cartes menu (nom, ingrédients, prix — pas de photo) */}
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-white/50">
            Aucun plat ne correspond à votre recherche.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-white">{it.name}</h3>
                  {it.description && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-white/55">
                      {it.description}
                    </p>
                  )}
                  {it.priceFrom != null && (
                    <p className="mt-1.5 text-sm font-bold" style={{ color: RED }}>
                      {it.hasMultipleSizes ? "dès " : ""}
                      {fmt(it.priceFrom)} <span className="text-white/40">TND</span>
                    </p>
                  )}
                </div>
                <OrderButton size="sm" withIcon={false} className="shrink-0">
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </OrderButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Bandeau marquee ──────────────────────────────────────────────────────
function Marquee({ words }: { words: string[] }) {
  const content = words.length
    ? words
    : ["SANDWICHS", "BURGERS", "PIZZAS", "BOISSONS", "FAIT MAISON"];
  const loop = [...content, ...content, ...content];
  return (
    <div className="bx-marquee relative overflow-hidden border-y border-white/10 bg-[#D40000] py-4">
      <div className="bx-marquee-track flex whitespace-nowrap">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {loop.map((w, i) => (
              <span
                key={`${k}-${i}`}
                className="bx-wordmark mx-6 text-2xl text-white/95 sm:text-3xl"
              >
                {w}
                <span className="mx-6 text-white/40">•</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── À Propos ─────────────────────────────────────────────────────────────
function About() {
  return (
    <section id="apropos" className="bg-[#0A0A0A] py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-6 lg:grid-cols-2">
        <div data-reveal className="bx-reveal">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: RED }}>
            Notre histoire
          </p>
          <h2 className="bx-section-title mt-2 text-4xl text-white sm:text-6xl">À Propos de Box</h2>
          <p className="mt-6 text-base leading-relaxed text-white/70">
            Box, c'est le fast-food gourmet qui met l'appétit au centre de tout. Des sandwichs
            généreux, des burgers qui débordent, des pizzas cuites comme il faut et de quoi étancher
            toutes les soifs. Ici, on choisit son plaisir et on repart rassasié.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[
              "Portions généreuses",
              "Sandwichs · Burgers · Pizzas",
              "Commande en ligne",
              "Livraison à domicile",
            ].map((b) => (
              <span
                key={b}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/75"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="mt-8">
            <OrderButton size="md" />
          </div>
        </div>

        <div data-reveal className="bx-reveal">
          <div className="bx-about-frame relative overflow-hidden rounded-3xl">
            <img
              src={vitrineAbout}
              alt="Une spécialité gourmande de Box"
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}


// ── FAQ ──────────────────────────────────────────────────────────────────
function Faq({ categoryNames }: { categoryNames: string[] }) {
  const carte =
    categoryNames.length > 0 ? categoryNames.join(", ") : "sandwichs, burgers, pizzas et boissons";

  const QA = [
    {
      q: "Peut-on commander en ligne ?",
      a: "Oui. Le bouton « Commander » ouvre directement l'application de commande Box, où vous composez votre panier et validez en quelques secondes.",
    },
    {
      q: "Que propose la carte ?",
      a: `La carte s'organise autour de ${categoryNames.length} catégories : ${carte}. Elle évolue régulièrement et le site affiche toujours la version à jour.`,
    },
    {
      q: "Box livre-t-il à domicile ?",
      a: `Oui, la livraison est possible dans un rayon d'environ ${DELIVERY_RADIUS_KM} km autour du restaurant. L'éligibilité de votre adresse est vérifiée automatiquement lors de la commande.`,
    },
    {
      q: "Où se trouve Box ?",
      a: "Retrouvez notre emplacement exact sur la carte de la section Localisation : un clic ouvre l'itinéraire dans Google Maps.",
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-[#0A0A0A] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <div data-reveal className="bx-reveal mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: RED }}>
            Vous vous demandez
          </p>
          <h2 className="bx-section-title mt-2 text-4xl text-white sm:text-6xl">FAQ</h2>
        </div>

        <div className="space-y-3">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-base font-extrabold text-white">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className="grid transition-all duration-300"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-white/65">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Localisation & contact ──────────────────────────────────────────────
function LocationSection() {
  return (
    <section id="localisation" className="bg-[#0A0A0A] py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-2">
        <div data-reveal className="bx-reveal">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: RED }}>
            Nous trouver
          </p>
          <h2 className="bx-section-title mt-2 mb-6 text-4xl text-white sm:text-5xl">
            Localisation
          </h2>
          <VitrineMap />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href={`tel:${PHONE_TEL}`}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20"
            >
              <Phone className="mt-0.5 h-5 w-5 shrink-0" style={{ color: RED }} />
              <div>
                <div className="text-sm font-extrabold text-white">Téléphone</div>
                <div className="text-[13px] text-white/55">{PHONE_DISPLAY}</div>
              </div>
            </a>
            <a
              href={DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20"
            >
              <Navigation className="mt-0.5 h-5 w-5 shrink-0" style={{ color: RED }} />
              <div>
                <div className="text-sm font-extrabold text-white">Itinéraire</div>
                <div className="text-[13px] text-white/55">Ouvrir dans Google Maps</div>
              </div>
            </a>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Truck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: RED }} />
              <div>
                <div className="text-sm font-extrabold text-white">Livraison</div>
                <div className="text-[13px] text-white/55">
                  Rayon d'environ {DELIVERY_RADIUS_KM} km
                </div>
              </div>
            </div>
          </div>

        </div>

        <div
          data-reveal
          className="bx-reveal flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8"
        >
          <UtensilsCrossed className="h-8 w-8" style={{ color: RED }} />
          <h3 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
            On vous garde une place au chaud
          </h3>
          <p className="mt-3 text-base text-white/65">
            Composez votre commande en ligne et récupérez-la fraîche, ou faites-vous livrer si vous
            êtes dans la zone. Deux clics et c'est parti.
          </p>
          <div className="mt-6">
            <OrderButton size="lg">Commander</OrderButton>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CTA final ────────────────────────────────────────────────────────────
function FinalCta() {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setOffset((window.innerHeight - rect.top) * 0.08);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={ref} className="bx-final relative overflow-hidden bg-[#0A0A0A] py-28 sm:py-36">
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(0, ${offset}px, 0) scale(1.15)`,
          backgroundImage: `url(${vitrineCta})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.85,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-[#0A0A0A]/85" />

      <div data-reveal className="bx-reveal relative mx-auto max-w-3xl px-5 text-center sm:px-6">
        <h2 className="bx-hero-title text-5xl leading-[0.95] text-white sm:text-7xl">
          Assez lu. On passe à table ?
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-base text-white/70 sm:text-lg">
          Votre prochain repas est à quelques clics. Chaud, généreux, prêt à partir.
        </p>
        <div className="mt-9 flex justify-center">
          <OrderButton size="lg">Commander maintenant</OrderButton>
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0A0A0A] py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 text-center sm:px-6">
        <span className="bx-wordmark text-3xl text-white">BOX</span>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            href={DIRECTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
          >
            <MapPin className="h-4 w-4" />
            Itinéraire Google Maps
          </a>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
          >
            <ShoppingBag className="h-4 w-4" />
            Commander en ligne
          </Link>
        </div>
        <p className="text-xs text-white/40">© 2026 Box, tous droits réservés.</p>
      </div>
    </footer>
  );
}

// ── Styles scoped ────────────────────────────────────────────────────────
const VITRINE_CSS = `
.vitrine-root { background: #0A0A0A; }
.vitrine-root section[id] { scroll-margin-top: 72px; }
.bx-wordmark { font-family: "Anton", "Poppins", system-ui, sans-serif; font-weight: 400; letter-spacing: 0.02em; text-transform: uppercase; }
.bx-hero-title, .bx-section-title { font-family: "Anton", "Poppins", system-ui, sans-serif; font-weight: 400; letter-spacing: 0.01em; text-transform: uppercase; }
.bx-hero-title { text-shadow: 0 0 26px rgba(212,0,0,0.55), 0 0 4px rgba(212,0,0,0.4); }
.bx-glow { text-shadow: 0 0 22px rgba(212,0,0,0.5); }

.bx-btn { transition: transform .15s ease; -webkit-tap-highlight-color: transparent; }
.bx-btn:active { transform: scale(0.97); }
.bx-btn-solid { background: #D40000; }
.bx-btn-solid::before {
  content: ""; position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.55) 50%, transparent 80%);
  transform: translateX(-130%); transition: transform .6s ease;
}
.bx-btn-solid:hover::before { transform: translateX(130%); }

.bx-nav-scrolled { background: rgba(10,10,10,0.72); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.08); }

/* Fond hero cinématique en CSS (aucune photo inventée) */
.bx-hero-bg {
  background:
    radial-gradient(120% 80% at 75% 15%, rgba(212,0,0,0.55) 0%, rgba(212,0,0,0) 45%),
    radial-gradient(90% 70% at 15% 85%, rgba(212,0,0,0.28) 0%, rgba(212,0,0,0) 50%),
    radial-gradient(60% 60% at 50% 40%, rgba(60,0,0,0.6) 0%, rgba(10,10,10,0) 70%),
    linear-gradient(135deg, #0A0A0A 0%, #1a0406 55%, #2a0709 100%);
}
.bx-hero-bg::after {
  content: ""; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.4px);
  background-size: 15px 15px; opacity: 0.5;
}

.bx-reveal { opacity: 0; transform: translateY(28px) scale(0.98); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.bx-reveal.is-visible { opacity: 1; transform: none; }

.bx-wave { animation: bxWave 6s ease-in-out infinite alternate; transform-origin: center; }
@keyframes bxWave { from { transform: translateY(0) scaleY(1); } to { transform: translateY(-6px) scaleY(1.05); } }

.bx-marquee-track { animation: bxMarquee 26s linear infinite; }
.bx-marquee { transform: skewY(-1.2deg); }
@keyframes bxMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

.bx-about-frame { box-shadow: 0 0 0 1px rgba(212,0,0,0.35), 0 0 40px rgba(212,0,0,0.25); }

.bx-float { animation: bxPulse 2.4s ease-in-out infinite; }
@keyframes bxPulse { 0%,100% { box-shadow: 0 10px 30px rgba(0,0,0,0.4), 0 0 0 0 rgba(212,0,0,0.45); } 50% { box-shadow: 0 10px 30px rgba(0,0,0,0.4), 0 0 0 12px rgba(212,0,0,0); } }
.bx-bubble { animation: bxBubbleIn .3s ease both; }
@keyframes bxBubbleIn { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: none; } }

/* Écran de chargement */
.bx-intro { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: #0A0A0A; animation: bxIntroOut .5s ease 1.4s forwards; }
.bx-intro-word { display: flex; gap: 0.05em; font-family: "Anton", system-ui, sans-serif; font-size: clamp(4rem, 22vw, 12rem); color: #fff; text-shadow: 0 0 40px rgba(212,0,0,0.7); }
.bx-intro-word span { opacity: 0; transform: translateY(40px); animation: bxLetter .5s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes bxLetter { to { opacity: 1; transform: none; } }
.bx-intro-wipe { position: absolute; inset: 0; background: #D40000; transform: scaleY(0); transform-origin: bottom; animation: bxWipe .5s ease 1.1s forwards; }
@keyframes bxWipe { 0% { transform: scaleY(0); transform-origin: bottom; } 50% { transform: scaleY(1); transform-origin: bottom; } 50.01% { transform-origin: top; } 100% { transform: scaleY(0); transform-origin: top; } }
@keyframes bxIntroOut { to { opacity: 0; visibility: hidden; } }

@media (prefers-reduced-motion: reduce) {
  .bx-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
  .bx-wave, .bx-marquee-track, .bx-float { animation: none !important; }
  .bx-btn-solid::before { display: none; }
}
`;

// ── Page ─────────────────────────────────────────────────────────────────
export function VitrineSite() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { categories, items, productCount, categoryCount } = useVitrineMenu();
  useRevealRoot(rootRef);

  const marqueeWords = categories.map((c) => c.name.toUpperCase());

  return (
    <div ref={rootRef} className="vitrine-root min-h-screen scroll-smooth">
      <style>{VITRINE_CSS}</style>
      <VitrineIntro />
      <Navbar />
      <FloatingOrder />

      <main>
        <Hero productCount={productCount} categoryCount={categoryCount} />
        <WaveDivider />
        <BestSellers />
        <MenuSection categories={categories} items={items} />
        <Marquee words={marqueeWords} />
        <About />
        <Faq categoryNames={categories.map((c) => c.name)} />
        <LocationSection />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}


export default VitrineSite;
