import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import {
  currentPermission,
  enablePushNotifications,
  hasActiveSubscription,
  isPushSupported,
} from "@/lib/push";

export function EnableNotifications({ role }: { role: "client" | "admin" | "livreur" }) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    setPerm(currentPermission());
    hasActiveSubscription().then((v) => {
      if (mounted) {
        setSubscribed(v);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ── Conditions d'affichage (loggées juste avant chacune) ──────────────────
  if (!isPushSupported() || perm === "unsupported") {
    return null;
  }

  // Permission refusée précédemment : au lieu d'un bouton grisé muet, on affiche
  // un indicateur explicite avec la marche à suivre pour débloquer.
  if (perm === "denied") {
    return (
      <button
        type="button"
        onClick={() =>
          toast.error(
            "Notifications bloquées. Autorisez-les dans les paramètres du site (icône près de l'adresse).",
          )
        }
        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-muted-foreground hover:bg-black/10 press"
        title="Notifications bloquées — autorisez-les dans les paramètres du site"
        aria-label="Notifications bloquées — autorisez-les dans les paramètres du site"
      >
        <BellOff className="h-5 w-5" />
      </button>
    );
  }

  // Tant que la vérification en base n'a pas répondu, on n'affiche rien pour
  // éviter un flash "Activer" alors qu'un abonnement existe.
  if (subscribed === null) {
    return null;
  }
  // Un abonnement RÉEL existe en base pour cet appareil → rien à proposer.
  // (On ne se fie pas à perm === "granted", qui peut être vrai sans ligne DB.)
  if (subscribed) {
    return null;
  }

  async function handle() {
    setBusy(true);
    const res = await enablePushNotifications(role);
    setBusy(false);
    if (res.ok) {
      setPerm("granted");
      setSubscribed(true);
      toast.success("Notifications activées");
    } else {
      toast.error(res.error ?? "Impossible d'activer les notifications");
      setPerm(currentPermission());
      setSubscribed(await hasActiveSubscription());
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground hover:bg-black/10 disabled:opacity-60 press"
      title="Activer les notifications"
      aria-label="Activer les notifications"
    >
      {busy ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
    </button>
  );
}
