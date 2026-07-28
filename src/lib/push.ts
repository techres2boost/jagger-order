import { supabase } from "@/integrations/supabase/client";

// Clé VAPID publique : lue depuis l'env (VITE_VAPID_PUBLIC_KEY). Repli sur la
// valeur historique pour ne rien casser si l'env n'est pas fournie au build.
// IMPORTANT : cette clé publique DOIT correspondre à la clé privée VAPID
// configurée côté serveur (secrets Supabase), sinon FCM rejette les push.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  "https://ssmmstetcmgsjnjbjkat.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbW1zdGV0Y21nc2puamJqa2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTUyMDgsImV4cCI6MjA5OTQzMTIwOH0.W7GFHmrowlCwxuMf9GAuqO1L0iLDf4sz3IUD9eHj86g";
const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
  "BKJVi0v15ZIYrtfEJgyJ-DPTAq2hu7pSGLhCmjYrTQ4znq7fjLyLOtxn3D925HE0Nbci8qvNrfgfG13IlgjXm4E";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function abToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com")
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Logs de diagnostic temporaires (préfixe [push]) pour repérer un enregistrement
  // ignoré silencieusement.
  if (!isPushSupported()) {
    console.warn("[push] SW non enregistré : notifications push non supportées sur cet appareil.");
    return null;
  }
  if (window.top !== window.self) {
    console.warn("[push] SW non enregistré : exécution dans une iframe (aperçu/éditeur).");
    return null; // don't register inside the editor iframe
  }
  if (isPreviewHost()) {
    console.warn(
      "[push] SW non enregistré : host de prévisualisation (déployez sur le vrai domaine).",
    );
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none", // ne jamais servir sw.js depuis le cache HTTP du navigateur
    });

    // Force une vérification immédiate de mise à jour à chaque chargement
    reg.update().catch(() => {});

    // Recharge la page une seule fois quand un nouveau SW prend le contrôle,
    // pour que le nouveau bundle JS (donc CartContext à jour) soit utilisé
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return reg;
  } catch (e) {
    console.error("[push] Échec de l'enregistrement du service worker.", e);
    return null;
  }
}

export async function enablePushNotifications(role: "client" | "admin" | "livreur"): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isPushSupported())
    return { ok: false, error: "Notifications non supportées sur cet appareil." };
  if (window.top !== window.self)
    return { ok: false, error: "Les notifications ne sont pas disponibles dans l'aperçu." };
  if (!VAPID_PUBLIC_KEY) {
    console.error("[push] Clé VAPID publique absente (VITE_VAPID_PUBLIC_KEY).");
    return { ok: false, error: "Configuration des notifications incomplète." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Permission refusée." };

  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh || abToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth || abToBase64(sub.getKey("auth"));

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    return { ok: false, error: "Vous devez être connecté pour activer les notifications." };
  }

  // Enregistrement via RPC SECURITY DEFINER : un endpoint push identifie un
  // appareil, pas un utilisateur. La RPC réattribue toujours la ligne à
  // l'utilisateur courant (user_id = auth.uid()), ce qui évite le conflit RLS
  // lorsqu'un autre compte a déjà utilisé ce même appareil, sans exposer les
  // abonnements d'autrui.
  const { error } = await (
    supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("save_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_role: role,
  });
  if (error) {
    console.error("[push] Enregistrement de l'abonnement échoué :", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Indique si un abonnement push RÉEL existe pour cet appareil : il faut à la fois
 * une souscription pushManager active ET une ligne correspondante (même endpoint)
 * dans push_subscriptions. On ne se fie pas à Notification.permission seul, qui
 * peut rester "granted" sans qu'aucune ligne n'existe en base (row supprimée,
 * jamais stockée, autre appareil…).
 */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;

    const { data, error } = await supabase
      .from("push_subscriptions" as never)
      .select("endpoint")
      .eq("endpoint", sub.endpoint)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}
