import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Edge Function : supprime le compte de l'utilisateur AUTHENTIFIÉ courant
// (auth.users) et ses données associées. Utilise la service role key, jamais
// exposée au client. L'identité est dérivée du JWT reçu (jamais d'un id fourni
// dans le corps de la requête) pour éviter toute suppression d'un autre compte.

// Ces variables sont injectées automatiquement par la plateforme Supabase
// dans l'environnement de chaque fonction déployée (aucune config manuelle).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "server_misconfigured" }, 500);
    }

    // Identité = utilisateur du JWT (et non un id fourni par le client).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return jsonResponse({ error: "missing_authorization" }, 401);
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "invalid_token" }, 401);
    }
    const userId = userData.user.id;

    // Suppression best-effort des tables auxiliaires liées à l'utilisateur.
    // On n'échoue pas si une table est absente : la suppression du compte
    // (auth.users) reste l'opération critique, et les tables avec FK
    // ON DELETE CASCADE (profiles, user_roles, orders…) sont nettoyées par la
    // suppression de l'utilisateur.
    for (const table of ["push_subscriptions", "addresses", "favorites"]) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
      if (error) {
        console.warn(`delete-account: skip ${table}:`, error.message);
      }
    }

    // Opération critique : suppression de l'utilisateur auth.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      return jsonResponse({ error: "failed_delete_auth", detail: authError.message }, 500);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (e: unknown) {
    console.error("delete-account error", e);
    return jsonResponse({ error: "unexpected_error", detail: String(e) }, 500);
  }
});
