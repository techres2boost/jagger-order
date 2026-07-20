import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY =
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
  if (!isPushSupported()) return null;
  if (window.top !== window.self) return null; // don't register inside the editor iframe
  if (isPreviewHost()) return null;
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
    console.error("SW register failed", e);
    return null;
  }
}

export async function enablePushNotifications(role: "client" | "admin"): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isPushSupported())
    return { ok: false, error: "Notifications non supportées sur cet appareil." };
  if (window.top !== window.self)
    return { ok: false, error: "Les notifications ne sont pas disponibles dans l'aperçu." };

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
  const payload: Record<string, unknown> = {
    endpoint,
    p256dh,
    auth,
    role,
    user_id: u.user?.id ?? null,
  };

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        upsert: (
          v: unknown,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}
