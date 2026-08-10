import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

// Edge Function invoquée par le trigger `on_late_delivery_notification` (via
// pg_net) quand une notification de type 'commande_en_retard' est insérée dans
// admin_notifications (le cron `notify_late_deliveries` détecte les livraisons
// dépassant l'heure d'arrivée prévue). Envoie un push aux abonnements admin
// (push_subscriptions.role = 'admin'). Même pattern que notify-admin-unassigned :
// aucune donnée sensible dans l'appel, service_role uniquement côté fonction.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
} else {
  webpush.setVapidDetails("https://wa.me/21644125122", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function sendToSubscriptions(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: string,
): Promise<number> {
  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("push send failed", err);
      }
    }
  }
  return sent;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    // Sécurité : ces fonctions ne sont appelées que par la base (triggers pg_net)
    // ou un job interne. Un secret partagé (PUSH_TRIGGER_SECRET) est exigé ;
    // sans lui, l'endpoint est inexploitable depuis l'extérieur.
    const expectedSecret = Deno.env.get("PUSH_TRIGGER_SECRET");
    const providedSecret = req.headers.get("x-push-secret");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const orderId = body?.order_id as string | undefined;
    // Message déjà composé côté base (admin_notifications.message) ; repli propre.
    const message =
      (typeof body?.message === "string" && body.message.trim()) ||
      (orderId
        ? `La commande #${orderId.slice(0, 8)} dépasse l'heure d'arrivée prévue`
        : "Une commande dépasse l'heure d'arrivée prévue");

    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("role", "admin");
    if (subsError) {
      return new Response(
        JSON.stringify({ error: "subs_lookup_failed", detail: subsError.message }),
        { status: 500 },
      );
    }

    const payload = JSON.stringify({
      title: "Jagger Admin",
      body: message,
      tag: orderId ? `order-late-${orderId}` : "order-late",
      url: "/admin",
    });

    const sent = await sendToSubscriptions(subscriptions ?? [], payload);
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) {
    console.error("notify-admin-late-delivery error", e);
    return new Response(JSON.stringify({ error: "unexpected_error", detail: String(e) }), {
      status: 500,
    });
  }
});
