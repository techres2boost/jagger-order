import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// --- Codes promo -----------------------------------------------------------
// Logique de code promo centralisée : un seul endroit décrit les codes connus
// et le calcul de la réduction, réutilisé par la page menu (stockage du code)
// et par le panier (calcul du total). Volontairement minimal.
export const WELCOME_PROMO_CODE = "WELCOME10";
const WELCOME_PROMO_RATE = 0.1; // -10 %

// Normalise un code saisi/reçu (URL) : trim + majuscules. Renvoie null si vide.
export function normalizePromoCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return code ? code : null;
}

// Réduction (montant absolu) appliquée à un sous-total pour un code donné.
// Renvoie 0 si le code est inconnu/absent. La règle d'éligibilité métier
// (ex. « première commande ») est décidée par l'appelant, pas ici.
export function promoDiscountAmount(subtotal: number, promoCode: string | null): number {
  if (normalizePromoCode(promoCode) !== WELCOME_PROMO_CODE) return 0;
  // Arrondi à 3 décimales (cohérent avec l'affichage des prix en TND).
  return Math.round(subtotal * WELCOME_PROMO_RATE * 1000) / 1000;
}

export interface CartOptionSelection {
  groupId: string;
  groupName: string;
  optionItemId: string;
  name: string;
  price: number;
  type: "retirable" | "supplement";
}

export interface CartLine {
  key: string; // itemId + size + options
  itemId: string;
  name: string;
  size?: string;
  unitPrice: number;
  qty: number;
  note?: string;
  options?: CartOptionSelection[];
}

interface CartCtx {
  lines: CartLine[];
  add: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  setNote: (key: string, note: string) => void;
  clear: () => void;
  total: number;
  count: number;
  // Code promo actif (ex. "WELCOME10"), persisté comme le panier. null si aucun.
  promoCode: string | null;
  applyPromo: (code: string) => void;
  removePromo: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

const CART_STORAGE_KEY = "box_cart";
const PROMO_STORAGE_KEY = "box_promo";

function loadCartFromStorage(): CartLine[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadPromoFromStorage(): string | null {
  try {
    return normalizePromoCode(localStorage.getItem(PROMO_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Initialisation paresseuse : lit le localStorage une seule fois au montage
  const [lines, setLines] = useState<CartLine[]>(() => loadCartFromStorage());
  const [promoCode, setPromoCode] = useState<string | null>(() => loadPromoFromStorage());

  // Persiste le panier à chaque modification (ajout, quantité, suppression, etc.)
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // localStorage indisponible (mode privé, quota dépassé, etc.) — on ignore silencieusement
    }
  }, [lines]);

  // Persiste le code promo actif (même logique que le panier).
  useEffect(() => {
    try {
      if (promoCode) localStorage.setItem(PROMO_STORAGE_KEY, promoCode);
      else localStorage.removeItem(PROMO_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [promoCode]);

  const value = useMemo<CartCtx>(() => {
    const optionsTotal = (l: CartLine) => (l.options ?? []).reduce((s, o) => s + o.price, 0);
    const total = lines.reduce((s, l) => s + (l.unitPrice + optionsTotal(l)) * l.qty, 0);
    const count = lines.reduce((s, l) => s + l.qty, 0);
    return {
      lines,
      total,
      count,
      promoCode,
      applyPromo: (code) => setPromoCode(normalizePromoCode(code)),
      removePromo: () => setPromoCode(null),
      add: (line) => {
        const optionsKey = (line.options ?? [])
          .map((o) => o.optionItemId)
          .sort()
          .join(",");
        const key = `${line.itemId}|${line.size ?? ""}|${optionsKey}`;
        setLines((prev) => {
          const existing = prev.find((l) => l.key === key);
          if (existing)
            return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l));
          return [...prev, { ...line, key }];
        });
      },
      setQty: (key, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((l) => l.key !== key)
            : prev.map((l) => (l.key === key ? { ...l, qty } : l)),
        ),
      remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      setNote: (key, note) =>
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, note } : l))),
      clear: () => {
        setLines([]);
        // La commande étant passée, l'offre de bienvenue est consommée :
        // on retire aussi le code promo actif.
        setPromoCode(null);
        try {
          localStorage.removeItem(CART_STORAGE_KEY);
        } catch {
          // ignore
        }
      },
    };
  }, [lines, promoCode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
