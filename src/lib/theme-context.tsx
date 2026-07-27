import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Système de thème « white-label » : chaque thème n'est qu'un jeu de variables
// CSS (voir aussi src/styles.css) + un mode de logo. Changer de restaurant
// client = changer ces valeurs, jamais la structure des composants.
export type ThemeId = "box" | "sakura" | "verde";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  restaurantName: string;
  // Seul le thème BOX a un vrai logo importé ; les autres affichent
  // l'emplacement neutre « LOGO CLIENT » (cf. design system, section 4).
  hasLogo: boolean;
  vars: Record<string, string>;
}

const THEMES: Record<ThemeId, ThemeDef> = {
  box: {
    id: "box",
    label: "Terracotta",
    restaurantName: "BOX Pizza",
    hasLogo: true,
    vars: {
      "--primary": "#B52400",
      "--primary-foreground": "#FFF8F1",
      "--background": "#FBF3E8",
      "--foreground": "#241812",
      "--card": "#FFFDF9",
      "--card-foreground": "#241812",
      "--popover": "#FFFDF9",
      "--popover-foreground": "#241812",
      "--muted-foreground": "#8B7365",
      "--border": "#E6D5C1",
      "--input": "#F4E7D6",
      "--ring": "#B52400",
      "--brand": "#B52400",
      "--brand-foreground": "#FFF8F1",
      "--brand-dark": "#2E1E17",
      "--secondary-warm": "#2E1E17",
      "--accent-warm": "#E39A2B",
      "--surface-2": "#F4E7D6",
    },
  },
  sakura: {
    id: "sakura",
    label: "Sakura",
    restaurantName: "Sakura",
    hasLogo: false,
    vars: {
      "--primary": "#A63A55",
      "--primary-foreground": "#FFF6F7",
      "--background": "#FBF1F2",
      "--foreground": "#221419",
      "--card": "#FFFBFC",
      "--card-foreground": "#221419",
      "--popover": "#FFFBFC",
      "--popover-foreground": "#221419",
      "--muted-foreground": "#8B6F78",
      "--border": "#E9CBD1",
      "--input": "#F6E3E6",
      "--ring": "#A63A55",
      "--brand": "#A63A55",
      "--brand-foreground": "#FFF6F7",
      "--brand-dark": "#2B1520",
      "--secondary-warm": "#2B1520",
      "--accent-warm": "#E0A458",
      "--surface-2": "#F6E3E6",
    },
  },
  verde: {
    id: "verde",
    label: "Verde",
    restaurantName: "Verde",
    hasLogo: false,
    vars: {
      "--primary": "#4F6B3A",
      "--primary-foreground": "#F7FAF0",
      "--background": "#F4F5EC",
      "--foreground": "#1C2118",
      "--card": "#FCFDF8",
      "--card-foreground": "#1C2118",
      "--popover": "#FCFDF8",
      "--popover-foreground": "#1C2118",
      "--muted-foreground": "#78806E",
      "--border": "#DCE1CB",
      "--input": "#E7EADA",
      "--ring": "#4F6B3A",
      "--brand": "#4F6B3A",
      "--brand-foreground": "#F7FAF0",
      "--brand-dark": "#1C2118",
      "--secondary-warm": "#1C2118",
      "--accent-warm": "#C98A2B",
      "--surface-2": "#E7EADA",
    },
  },
};

export const THEME_LIST: ThemeDef[] = [THEMES.box, THEMES.sakura, THEMES.verde];

const STORAGE_KEY = "box_theme";

interface ThemeCtx {
  themeId: ThemeId;
  theme: ThemeDef;
  setThemeId: (id: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Toujours "box" au premier rendu (y compris côté serveur) pour que
  // l'hydratation corresponde au HTML généré ; la préférence sauvegardée est
  // relue juste après montage (comme --bottom-nav-height ou le splash).
  const [themeId, setThemeIdState] = useState<ThemeId>("box");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "box" || stored === "sakura" || stored === "verde") {
        setThemeIdState(stored);
      }
    } catch {
      // localStorage indisponible : on reste sur le thème par défaut.
    }
  }, []);

  useEffect(() => {
    const theme = THEMES[themeId];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) {
      root.style.setProperty(key, value);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // ignore
    }
  }, [themeId]);

  return (
    <Ctx.Provider value={{ themeId, theme: THEMES[themeId], setThemeId: setThemeIdState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
