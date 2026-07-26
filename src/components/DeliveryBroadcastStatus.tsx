"use client";

import { Navigation, WifiOff } from "lucide-react";
import { useDriverBroadcast } from "@/components/DriverBroadcastProvider";

// Badge en LECTURE SEULE affiché dans le modal de détail commande. Il ne fait
// que refléter l'état du partage géré globalement par DriverBroadcastProvider ;
// il ne déclenche aucun broadcast.
export function DeliveryBroadcastStatus({ orderId }: { orderId: string }) {
  const { activeOrderIds, gpsLost } = useDriverBroadcast();
  const active = activeOrderIds.includes(orderId);

  const lost = gpsLost && active;
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
        lost ? "bg-destructive/15 text-destructive" : "bg-brand/10 text-brand"
      }`}
    >
      {lost ? (
        <>
          <WifiOff className="h-4 w-4" />
          Signal GPS perdu
        </>
      ) : (
        <>
          <Navigation className="h-4 w-4" />
          {active ? "Position partagée en direct" : "Activation du partage…"}
        </>
      )}
    </div>
  );
}
