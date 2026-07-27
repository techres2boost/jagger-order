import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

// Edge Function invoquée par le trigger Postgres `trg_order_message_notify` à
// chaque INSERT dans `order_messages`. Envoie un push au SEUL autre participant
// du chat (client <-> livreur assigné) avec le contenu tronqué à 50 caractères.
// Réutilise le même mécanisme VAPID/web-push que les autres flux push du projet.

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

const MAX_PREVIEW = 50;

// Tronque le contenu à 50 caractères (ellipse si dépassement), sur une seule ligne.
function previewContent(content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= MAX_PREVIEW) return oneLine;
  return oneLine.slice(0, MAX_PREVIEW).trimEnd() + "…";
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
    const senderId = body?.sender_id as string | undefined;
    const content = (body?.content as string | undefined) ?? "";
    if (!orderId || !senderId) {
      return new Response(JSON.stringify({ error: "order_id and sender_id required" }), {
        status: 400,
      });
    }

    // Résout les deux participants de la commande : client (orders.user_id) et
    // compte auth du livreur assigné (livreurs.user_id).
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("user_id, assigned_livreur_id")
      .eq("id", orderId)
      .single();
    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "order_not_found", detail: orderError?.message }),
        { status: 404 },
      );
    }

    const clientUserId = order.user_id as string;
    let livreurUserId: string | null = null;
    if (order.assigned_livreur_id) {
      const { data: livreur } = await supabaseAdmin
        .from("livreurs")
        .select("user_id")
        .eq("id", order.assigned_livreur_id)
        .single();
      livreurUserId = (livreur?.user_id as string | null) ?? null;
    }

    // Le destinataire est l'autre participant que l'expéditeur.
    let recipientUserId: string | null;
    let recipientRole: "client" | "livreur";
    let recipientUrl: string;
    if (senderId === clientUserId) {
      recipientUserId = livreurUserId;
      recipientRole = "livreur";
      recipientUrl = "/livreur";
    } else {
      recipientUserId = clientUserId;
      recipientRole = "client";
      recipientUrl = `/commande/${orderId}`;
    }

    if (!recipientUserId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_recipient" }), { status: 200 });
    }

    // Nom de l'expéditeur pour le titre (via profiles, lecture admin sans RLS).
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", senderId)
      .maybeSingle();
    const senderName = (senderProfile?.full_name as string | null)?.trim() || "Nouveau message";

    // Abonnements push du destinataire pour le bon rôle.
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", recipientUserId)
      .eq("role", recipientRole);
    if (subsError) {
      return new Response(
        JSON.stringify({ error: "subs_lookup_failed", detail: subsError.message }),
        { status: 500 },
      );
    }

    const payload = JSON.stringify({
      title: senderName,
      body: previewContent(content),
      tag: `order-message-${orderId}`,
      url: recipientUrl,
    });

    const sent = await sendToSubscriptions(subscriptions ?? [], payload);

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) {
    console.error("notify-order-message error", e);
    return new Response(JSON.stringify({ error: "unexpected_error", detail: String(e) }), {
      status: 500,
    });
  }
});
