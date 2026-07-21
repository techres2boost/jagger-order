import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

// Edge Function invoquée par le trigger Postgres `trg_order_livreur_assigned`
// quand une commande est assignée à un livreur (assigned_livreur_id passe à une
// nouvelle valeur non nulle). Envoie un push aux abonnements du livreur concerné
// (push_subscriptions.role = 'livreur') pour l'informer de la nouvelle commande.
// Flux strictement isolé : ne touche ni aux notifications client ni admin.

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

    const body = await req.json();
    const livreurId = body?.livreur_id as string | undefined;
    const orderId = body?.order_id as string | undefined;
    if (!livreurId || !orderId) {
      return new Response(JSON.stringify({ error: "livreur_id and order_id required" }), {
        status: 400,
      });
    }

    // Résoudre le compte utilisateur (auth.users) rattaché à cette fiche livreur.
    const { data: livreur, error: livreurError } = await supabaseAdmin
      .from("livreurs")
      .select("user_id")
      .eq("id", livreurId)
      .single();
    if (livreurError || !livreur?.user_id) {
      return new Response(
        JSON.stringify({ error: "livreur_not_found", detail: livreurError?.message }),
        { status: 404 },
      );
    }

    // Récupérer les abonnements push du livreur (rôle 'livreur' uniquement).
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", livreur.user_id)
      .eq("role", "livreur");
    if (subsError) {
      return new Response(
        JSON.stringify({ error: "subs_lookup_failed", detail: subsError.message }),
        { status: 500 },
      );
    }

    // Numéro de commande affiché comme dans l'UI (#8 premiers caractères).
    const shortId = orderId.slice(0, 8);
    const payload = JSON.stringify({
      title: "BOX Livreur",
      body: `Nouvelle commande #${shortId} qui vous a été attribuée`,
      tag: `order-assign-${orderId}`,
      url: "/livreur",
    });

    const sent = await sendToSubscriptions(subscriptions ?? [], payload);

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) {
    console.error("notify-livreur error", e);
    return new Response(JSON.stringify({ error: "unexpected_error", detail: String(e) }), {
      status: 500,
    });
  }
});
