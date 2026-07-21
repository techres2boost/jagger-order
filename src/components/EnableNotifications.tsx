import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import {
  currentPermission,
  enablePushNotifications,
  hasActiveSubscription,
  isPushSupported,
} from "@/lib/push";

export function EnableNotifications({ role }: { role: "client" | "admin" }) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    setPerm(currentPermission());
    hasActiveSubscription().then((v) => {
      if (mounted) setSubscribed(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!isPushSupported() || perm === "unsupported") return null;
  if (perm === "denied") return null;
  // Tant que la vérification en base n'a pas répondu, on n'affiche rien pour
  // éviter un flash "Activer" alors qu'un abonnement existe.
  if (subscribed === null) return null;
  // Un abonnement RÉEL existe en base pour cet appareil → rien à proposer.
  // (On ne se fie pas à perm === "granted", qui peut être vrai sans ligne DB.)
  if (subscribed) return null;

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
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-60 press"
      title="Activer les notifications"
      aria-label="Activer les notifications"
    >
      {busy ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
    </button>
  );
}
