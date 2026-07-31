// Détecte si l'app tourne en mode « application installée » (standalone)
// plutôt que dans un onglet de navigateur classique.
//
// On combine plusieurs signaux pour couvrir les différentes plateformes :
//   - PWA installée (Chrome/Edge/Android, Windows, etc.)
//   - PWA installée sur iOS Safari (API propriétaire `navigator.standalone`)
//   - TWA Android (Trusted Web Activity, ouverte depuis un wrapper natif)
//   - Wrapper Capacitor / Cordova, si un jour l'app est empaquetée en natif
//
// Utilise uniquement des APIs natives du navigateur, aucune dépendance.

// Fenêtre étendue avec les APIs non standard utilisées ci-dessous.
interface StandaloneWindow extends Window {
  // Safari iOS expose `standalone` sur navigator quand la PWA est lancée
  // depuis l'écran d'accueil.
  navigator: Navigator & { standalone?: boolean };
  // Présents seulement si l'app est empaquetée avec Capacitor / Cordova.
  Capacitor?: { isNativePlatform?: () => boolean };
  cordova?: unknown;
}

export function isStandaloneApp(): boolean {
  // Sécurité SSR / environnement sans DOM : on considère « non standalone ».
  if (typeof window === "undefined") return false;

  const win = window as StandaloneWindow;

  // 1) PWA installée : le média `display-mode: standalone` est actif.
  const isPwaStandalone =
    typeof win.matchMedia === "function" && win.matchMedia("(display-mode: standalone)").matches;

  // 2) PWA iOS : API propriétaire de Safari.
  const isIosStandalone = win.navigator.standalone === true;

  // 3) TWA Android : la page est ouverte depuis un wrapper `android-app://`.
  const isAndroidTwa =
    typeof document !== "undefined" && document.referrer.includes("android-app://");

  // 4) Wrapper natif Capacitor / Cordova, si présent.
  const isNativeWrapper = win.Capacitor?.isNativePlatform?.() === true || win.cordova != null;

  return isPwaStandalone || isIosStandalone || isAndroidTwa || isNativeWrapper;
}
