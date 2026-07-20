import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
}

const Ctx = createContext<CartCtx | null>(null);

const CART_STORAGE_KEY = "box_cart";

function loadCartFromStorage(): CartLine[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Initialisation paresseuse : lit le localStorage une seule fois au montage
  const [lines, setLines] = useState<CartLine[]>(() => loadCartFromStorage());

  // Persiste le panier à chaque modification (ajout, quantité, suppression, etc.)
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // localStorage indisponible (mode privé, quota dépassé, etc.) — on ignore silencieusement
    }
  }, [lines]);

  const value = useMemo<CartCtx>(() => {
    const optionsTotal = (l: CartLine) => (l.options ?? []).reduce((s, o) => s + o.price, 0);
    const total = lines.reduce((s, l) => s + (l.unitPrice + optionsTotal(l)) * l.qty, 0);
    const count = lines.reduce((s, l) => s + l.qty, 0);
    return {
      lines,
      total,
      count,
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
        try {
          localStorage.removeItem(CART_STORAGE_KEY);
        } catch {
          // ignore
        }
      },
    };
  }, [lines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
