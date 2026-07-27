import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

// Edge Function invoquée par le Database Webhook `notify-order-ready`
// (supabase_functions.http_request) à chaque INSERT/UPDATE de `orders`, et
// tolérante aux appels directs { order_id, status }. Envoie un push aux
// abonnements du client concerné (push_subscriptions.role = 'client') avec le
// même texte que l'écran de suivi de commande, uniquement quand le statut change.

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
  webpush.setVapidDetails("mailto:contact@box-app.tn", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type OrderStatus =
  | "pending"
  | "accepted"
  | "ready"
  | "delivering"
  | "delivered"
  | "refused"
  | "expired"
  | "cancelled";

const REFUSAL_LABEL: Record<"unavailable" | "busy", string> = {
  unavailable: "Plat non disponible",
  busy: "Restaurant occupé",
};

// Mêmes textes que l'écran de suivi de commande côté client (Tâche 2/3).
function buildMessage(status: OrderStatus, refusalReason: string | null): string | null {
  switch (status) {
    case "accepted":
      return "Votre commande est en cours de préparation.";
    case "ready":
      return "Votre commande est prête et va être prise en charge pour la livraison.";
    case "delivering":
      return "Votre commande est en route !";
    case "delivered":
      return "Votre commande a été livrée. Bon appétit !";
    case "refused": {
      const reasonLabel =
        refusalReason === "unavailable" || refusalReason === "busy"
          ? REFUSAL_LABEL[refusalReason]
          : null;
      return reasonLabel ? `Commande refusée : ${reasonLabel}` : "Votre commande a été refusée.";
    }
    case "expired":
      return "Votre commande n'a pas été confirmée à temps.";
    case "cancelled":
      return "Votre commande a été annulée.";
    default:
      return null;
  }
}

// Envoie `payload` à tous les abonnements donnés, en retirant ceux qui sont expirés.
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
        // Abonnement expiré côté navigateur : on le retire.
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

    // Supporte deux formes de payload :
    //  - Database Webhook Supabase : { type, table, record, old_record }
    //  - Appel direct : { order_id, status }
    const record = (body?.record ?? null) as
      | { id?: string; status?: OrderStatus; user_id?: string; refusal_reason?: string | null }
      | null;
    const oldRecord = (body?.old_record ?? null) as { status?: OrderStatus } | null;

    const orderId = (record?.id ?? body?.order_id) as string | undefined;
    const status = (record?.status ?? body?.status) as OrderStatus | undefined;
    if (!orderId || !status) {
      return new Response(JSON.stringify({ error: "order_id and status required" }), {
        status: 400,
      });
    }

    // Le webhook se déclenche sur INSERT et sur CHAQUE UPDATE. On n'envoie une
    // notification que lorsque le statut a réellement changé, pour éviter les
    // doublons sur les updates sans changement de statut (assignation, timestamps…).
    if (record && oldRecord && oldRecord.status === record.status) {
      return new Response(JSON.stringify({ ok: true, skipped: "status_unchanged" }), {
        status: 200,
      });
    }

    const message = buildMessage(status, null);
    if (!message) {
      // Statut sans notification définie (ex. pending) : rien à envoyer.
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    // Résout user_id + refusal_reason : depuis le record du webhook si présent,
    // sinon via une lecture ciblée (appel direct).
    let userId = record?.user_id;
    let refusalReason: string | null = record?.refusal_reason ?? null;
    if (!userId) {
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("user_id, refusal_reason")
        .eq("id", orderId)
        .single();
      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: "order_not_found", detail: orderError?.message }),
          { status: 404 },
        );
      }
      userId = order.user_id;
      refusalReason = order.refusal_reason ?? null;
    }

    const finalMessage = status === "refused" ? buildMessage(status, refusalReason) : message;

    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)
      .eq("role", "client");
    if (subsError) {
      return new Response(JSON.stringify({ error: "subs_lookup_failed", detail: subsError.message }), {
        status: 500,
      });
    }

    const clientPayload = JSON.stringify({ title: "BOX", body: finalMessage });
    const sent = await sendToSubscriptions(subscriptions ?? [], clientPayload);

    // Note : la notification du livreur lors de l'assignation d'une commande est
    // gérée par un flux dédié et isolé (trigger trg_order_livreur_assigned +
    // Edge Function notify-livreur), et non ici.

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) {
    console.error("send-order-notification error", e);
    return new Response(JSON.stringify({ error: "unexpected_error", detail: String(e) }), {
      status: 500,
    });
  }
});
