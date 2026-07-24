import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AVATAR_EVENT = "avatar-updated";

export function notifyAvatarChanged(url: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: url }));
}

// Hook partagé : lit profiles.avatar_url pour l'utilisateur connecté et se
// remet à jour dès qu'un autre composant appelle notifyAvatarChanged().
export function useAvatar(userId: string | null | undefined) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAvatarUrl(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const url = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    // Cache-buster : ajoute ?t= pour éviter d'afficher une ancienne version
    // (les URLs publiques sont stables même après upsert).
    setAvatarUrl(url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : null);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setAvatarUrl(detail ? `${detail}${detail.includes("?") ? "&" : "?"}t=${Date.now()}` : null);
    };
    window.addEventListener(AVATAR_EVENT, handler);
    return () => window.removeEventListener(AVATAR_EVENT, handler);
  }, []);

  return { avatarUrl, refresh };
}
