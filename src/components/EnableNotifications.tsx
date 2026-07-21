import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { currentPermission, enablePushNotifications, isPushSupported } from "@/lib/push";

export function EnableNotifications({ role }: { role: "client" | "admin" }) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerm(currentPermission());
  }, []);

  if (!isPushSupported() || perm === "unsupported") return null;
  if (perm === "granted") return null;
  if (perm === "denied") return null;

  async function handle() {
    setBusy(true);
    const res = await enablePushNotifications(role);
    setBusy(false);
    if (res.ok) {
      setPerm("granted");
      toast.success("Notifications activées");
    } else {
      toast.error(res.error ?? "Impossible d'activer les notifications");
      setPerm(currentPermission());
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
