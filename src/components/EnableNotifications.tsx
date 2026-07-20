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
      className="flex h-9 items-center gap-1 rounded-full border border-brand px-3 text-xs font-semibold text-brand disabled:opacity-60"
      title="Activer les notifications"
    >
      {busy ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      <span className="hidden sm:inline">Activer les notifications</span>
      <span className="sm:hidden">Notifs</span>
    </button>
  );
}
