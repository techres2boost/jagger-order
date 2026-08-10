import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Système de thème « white-label » : un thème n'est qu'un jeu de variables
// CSS (voir aussi src/styles.css) + un mode de logo. Changer de restaurant
// client = changer ces valeurs, jamais la structure des composants.
export type ThemeId = "jagger";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  restaurantName: string;
  // Un thème sans logo importé affiche l'emplacement neutre « LOGO CLIENT »
  // (cf. design system, section 4).
  hasLogo: boolean;
  vars: Record<string, string>;
}

const THEMES: Record<ThemeId, ThemeDef> = {
  jagger: {
    id: "jagger",
    label: "Jagger",
    restaurantName: "Jagger",
    hasLogo: true,
    vars: {
      "--primary": "#000000",
      "--primary-foreground": "#FFFFFF",
      "--background": "#F5F5F0",
      "--foreground": "#0D0D0D",
      "--card": "#FFFFFF",
      "--card-foreground": "#0D0D0D",
      "--popover": "#FFFFFF",
      "--popover-foreground": "#0D0D0D",
      "--muted-foreground": "#6E6E68",
      "--border": "#E2E2DA",
      "--input": "#ECECE4",
      "--ring": "#000000",
      "--brand": "#1A1A1A",
      "--brand-foreground": "#FFFFFF",
      "--brand-dark": "#0D0D0D",
      "--secondary-warm": "#262626",
      "--accent-warm": "#E5E5E5",
      "--surface-2": "#ECECE4",
    },
  },
};

export const THEME_LIST: ThemeDef[] = [THEMES.jagger];

const DEFAULT_THEME_ID: ThemeId = "jagger";

const STORAGE_KEY = "jagger_theme";

function isThemeId(value: string | null): value is ThemeId {
  return value !== null && value in THEMES;
}

interface ThemeCtx {
  themeId: ThemeId;
  theme: ThemeDef;
  setThemeId: (id: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Toujours le thème par défaut au premier rendu (y compris côté serveur) pour
  // que l'hydratation corresponde au HTML généré ; la préférence sauvegardée est
  // relue juste après montage (comme --bottom-nav-height ou le splash).
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isThemeId(stored)) {
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
