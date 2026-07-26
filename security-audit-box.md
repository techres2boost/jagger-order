# Audit de sécurité — BOX (Supabase / React)

> **Projet Supabase audité** : `The Box` (`ssmmstetcmgsjnjbjkat`, région eu-central-2, Postgres 17.6).
> **Méthode** : lecture des 28 migrations SQL (`supabase/migrations/`) **+ introspection de la base live** (pg_policies, role_table_grants, pg_proc, `get_advisors`) **+ revue du frontend** (`src/`) et des Edge Functions.
> **Date** : 2026-07-26. **Aucun fichier n'a été modifié.** Ce rapport attend votre validation avant tout correctif.
>
> ⚠️ **Constat structurant** : le schéma live a **fortement divergé des migrations**. Plusieurs tables et TOUTES leurs policies (`addresses`, `push_subscriptions`, `livreurs`, `livreur_stats`, `admin_notifications`, `categories`/`menu_items` *version live*, `menu_item_sizes`, `option_groups`, `option_items`, `menu_item_option_groups`) ainsi que plusieurs fonctions (`check_late_orders`, `notify_late_deliveries`, `trigger_late_delivery_push`, `check_max_5_addresses`) **n'existent pas dans `supabase/migrations/` et ont été créées via l'éditeur Lovable Cloud**. Le versionnement Git ne reflète donc PAS l'état de sécurité réel : c'est en soi un risque de gouvernance (⚠️ voir §5).

## Synthèse (sévérités)

| # | Sévérité | Titre court |
|---|----------|-------------|
| F-01 | 🔴 Bloquant | `check_late_orders` / `notify_late_deliveries` / `trigger_late_delivery_push` : SECURITY DEFINER, **search_path non fixé**, **exécutables par `anon`** |
| F-02 | 🟠 Majeur | `orders.total` (et items) écrits en direct par le client sans revalidation serveur → sous-facturation |
| F-03 | 🟠 Majeur | `order_ratings` INSERT live plus permissif que la migration (ne vérifie plus la propriété de la commande) |
| F-04 | 🟠 Majeur | `orders_livreur_update` : le livreur peut modifier **n'importe quelle colonne** (statut, total) de ses commandes assignées, sans garde de transition côté RLS |
| F-05 | 🟠 Majeur | `.env` **suivi dans Git** et **non ignoré** par `.gitignore` |
| F-06 | 🟡 Mineur | `trigger_late_delivery_push` contient un placeholder `NOM_DE_TA_FONCTION` + lit `app.settings.service_role_key` (fonction morte/dangereuse) |
| F-07 | 🟡 Mineur | `admin_notifications` : RLS activé, **0 policy** (table inaccessible sauf service_role) — à confirmer intentionnel |
| F-08 | 🟡 Mineur | Buckets publics `avatars`, `dish-images`, `menu-images` : SELECT large → **listing** de tous les fichiers |
| F-09 | 🟡 Mineur | GRANTs par défaut larges (`ALL` incl. `DELETE`/`TRUNCATE`) sur `anon`/`authenticated` pour toutes les tables (défense en profondeur) |
| F-10 | 🟡 Mineur | Protection « mots de passe compromis » (HaveIBeenPwned) désactivée dans Auth |
| F-11 | ⚠️ | Schéma/policies critiques hors migrations (non versionnés) |

Aucune fuite de `service_role` / secret Twilio n'a été trouvée côté client (✅ voir §4).

---

## 1. RLS (Row Level Security) — table par table

**RLS est activé sur les 19 tables du schéma `public`** (vérifié live : `relrowsecurity = true` partout). ✅ Aucune table sans RLS.

Légende accès : `own` = propriétaire (`auth.uid()`), `admin` = `has_role(admin)`, `livreur` = livreur assigné, `public` = anon+authenticated.

| Table | SELECT | INSERT | UPDATE | DELETE | Verdict |
|-------|--------|--------|--------|--------|---------|
| `profiles` | own + participants livraison (`shares_active_delivery`) | own (`id=auth.uid`) | own | ❌ aucune policy | ✅ Correct (pas de DELETE voulu) |
| `user_roles` | own + admin | ❌ aucune | ❌ aucune | ❌ aucune | ✅ **Écriture impossible via API** (aucune policy permissive) → pas d'auto-escalade de rôle. Bon. |
| `orders` | own + admin + livreur assigné | own (`user_id=auth.uid`) | admin **+ livreur assigné** + owner-cancel (`pending→cancelled`) | ❌ aucune | ⚠️ voir **F-04** (livreur trop large) ; `total` non contraint voir **F-02** |
| `order_items` | own + admin | own (via jointure `orders.user_id`) | ❌ | ❌ | ✅ Correct |
| `order_item_options` | own (jointure) + admin(ALL) | own (jointure) | admin | admin | ✅ Correct |
| `order_ratings` | own + admin | **own uniquement** (`auth.uid()=user_id`) | ❌ (live) | ❌ | ❌ **F-03** : la migration exigeait aussi `order.user_id=auth.uid()` ; la policy live ne le fait plus |
| `livreur_ratings` | own | own **+ vérif propriété commande** | own + vérif | ❌ | ✅ Correct (conforme migration) |
| `order_messages` | `can_access_order_chat` (participant, statut delivering) | idem + `sender_id=auth.uid()` | ❌ | ❌ | ✅ Correct (anti-usurpation) |
| `addresses` | own + admin + livreur assigné | own (ALL) | own | own | ✅ Correct ; limite 5 via trigger `check_max_5_addresses` (existe live) |
| `push_subscriptions` | own | own | own | ❌ aucune (suppression par Edge Function via service_role) | ✅ Correct |
| `livreurs` | own + admin(ALL) | admin | admin | admin | ✅ Correct |
| `livreur_stats` | *(vue/table — grants larges)* | — | — | — | ⚠️ à vérifier : présence de policy et nature (vue ?) |
| `categories` | **public `true`** + admin(ALL) | admin | admin | admin | ✅ Menu public en lecture, écriture admin |
| `menu_items` | **public `true`** + admin(ALL) | admin | admin | admin | ✅ Idem |
| `menu_item_sizes` | public `true` + admin(ALL) | admin | admin | admin | ✅ |
| `option_groups` | public `true` + admin(ALL) | admin | admin | admin | ✅ |
| `option_items` | public `true` + admin(ALL) | admin | admin | admin | ✅ |
| `menu_item_option_groups` | public `true` + admin(ALL) | admin | admin | admin | ✅ |
| `app_settings` | admin | ❌ | admin | ❌ | ✅ Réglages admin only |
| `admin_notifications` | ❌ **0 policy** | ❌ | ❌ | ❌ | ⚠️ **F-07** : RLS on, aucune policy → seul `service_role` accède. Si l'UI admin doit lire ces notifs, c'est cassé ; sinon OK (deny-by-default). |

### Détail des points RLS

**✅ Ce qui est correct**
- RLS activé partout ; `user_roles` verrouillé en écriture (pas d'escalade de rôle) ; commandes/adresses/messages/notes correctement scoping par `auth.uid()` ; menu en lecture publique + écriture admin ; chat limité aux participants d'une livraison en cours ; owner-cancel `orders` restreint à `pending→cancelled` (belle policy).

**⚠️ À vérifier manuellement**
- **F-07 `admin_notifications`** : confirmer que c'est intentionnel (écrit par `notify_late_deliveries` via service_role, jamais lu côté client) — sinon ajouter une policy `SELECT` admin.
- `livreur_stats` : déterminer si c'est une **vue** (les vues n'appliquent pas la RLS de leurs tables sources sauf `security_invoker`) ou une table ; vérifier qu'elle n'expose pas de données trans-livreurs.

**❌ Vulnérable**
- **F-03 `order_ratings` INSERT** — *live* : `WITH CHECK (auth.uid() = user_id)` seulement. La migration `supabase/migrations/20260711120000_add_order_ratings.sql:16-17` définissait en plus `AND auth.uid() = (SELECT user_id FROM orders WHERE id = order_id)`. **Risque** : un utilisateur peut créer une note (`rating`, `comment`) rattachée à une commande qui n'est **pas la sienne** (spoof de notes ; pollution des stats). L'index unique `(order_id,user_id)` limite le volume mais pas l'usurpation.
  - *Correctif proposé (à valider)* :
    ```sql
    DROP POLICY "Users can insert their own ratings" ON public.order_ratings;
    CREATE POLICY "order_ratings_owner_insert" ON public.order_ratings
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id
        AND auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id));
    ```
- **F-04 `orders_livreur_update`** — `USING/CHECK (assigned_livreur_id IN (SELECT id FROM livreurs WHERE user_id = auth.uid()))`. Aucune restriction de colonne ni de transition de statut. **Risque** : un livreur, via appel PostgREST direct, peut passer une commande assignée à `delivered` sans livrer, ou modifier `total`, `address`, etc. Les gardes `.eq("status","delivering")` de `DriverOrders.tsx` ne sont **pas** appliquées par la RLS.
  - *Correctif proposé (à valider)* : restreindre les transitions autorisées côté RLS (ex. `ready→delivering` et `delivering→delivered` uniquement) ou faire passer ces updates par une RPC `SECURITY DEFINER` qui valide la transition et fige les colonnes sensibles.

---

## 2. Écritures directes vs RPC `SECURITY DEFINER`

### 2.a Droits directs `anon` / `authenticated`

Introspection live (`information_schema.role_table_grants`) : **`anon` ET `authenticated` disposent de `SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER` (= `ALL`) sur TOUTES les tables `public`.**

- C'est le **modèle par défaut Supabase** : la sécurité repose entièrement sur la RLS, et PostgREST n'expose que SELECT/INSERT/UPDATE/DELETE (pas TRUNCATE). Les écritures restent donc **gouvernées par les policies** ci-dessus (ex. pas de policy write sur `user_roles` ⇒ refus).
- **⚠️ F-09 (défense en profondeur)** : les GRANTs restrictifs voulus par la migration de base (`20260709115252` : `orders` seulement `SELECT,INSERT,UPDATE`, pas de DELETE ; `user_roles` seulement `SELECT`) ont été **écrasés** par des GRANTs larges. En cas d'oubli futur d'une policy, la table serait immédiatement exposée. Recommandation : `REVOKE` explicite de `DELETE, TRUNCATE, INSERT, UPDATE` là où aucune policy correspondante n'existe (notamment `user_roles`, `orders` DELETE, `app_settings` INSERT/DELETE).

### 2.b Fonctions RPC `SECURITY DEFINER` (15 recensées live)

| Fonction | search_path | Exécutable par | Garde d'identité/rôle | Verdict |
|----------|-------------|----------------|------------------------|---------|
| `has_role` | ✅ public | authenticated | (lecture seule) | ✅ |
| `expire_stale_orders` | ✅ public | (aucun grant direct) | opère sur `pending` expirés | ✅ |
| `handle_new_user` | ✅ public | (trigger only) | — | ✅ |
| `save_push_subscription` | ✅ public | authenticated | `auth.uid()` obligatoire + whitelist rôle | ✅ réassigne `user_id=auth.uid()` |
| `admin_order_filters` | ✅ public | authenticated | ✅ `has_role(admin)` sinon exception | ✅ |
| `admin_process_assignments` | ✅ public | authenticated | ✅ `has_role(admin)` sinon exception | ✅ |
| `process_delivery_assignments` | ✅ public | (aucun grant) | worker interne | ✅ |
| `can_access_order_chat` | ✅ public | authenticated | logique participant | ✅ |
| `shares_active_delivery` | ✅ public | authenticated | logique participant | ✅ |
| `set_order_arrival_at` | ✅ public | anon+authenticated | trigger, mais **grant direct anon** | ⚠️ révoquer l'EXECUTE direct |
| `notify_livreur_assignment` | ✅ public | (trigger only) | — | ✅ |
| `notify_order_message` | ✅ public | (aucun grant) | — | ✅ |
| **`check_late_orders`** | ❌ **absent** | **anon+authenticated** | ❌ aucune | ❌ **F-01** |
| **`notify_late_deliveries`** | ❌ **absent** | **anon+authenticated** | ❌ aucune | ❌ **F-01** |
| **`trigger_late_delivery_push`** | ❌ **absent** | **anon+authenticated** | ❌ aucune | ❌ **F-01/F-06** |

**❌ F-01 (🔴)** — Les trois fonctions `check_late_orders`, `notify_late_deliveries`, `trigger_late_delivery_push` :
1. sont **`SECURITY DEFINER` sans `SET search_path`** → vulnérables au **search_path hijacking** (un objet malveillant dans un schéma prioritaire — ex. `net`, `orders` — pourrait être résolu à la place de l'objet attendu, s'exécutant avec les privilèges du *owner* de la fonction, typiquement `postgres`).
2. sont **exécutables par `anon`** via `/rest/v1/rpc/<fn>` **sans authentification**. `check_late_orders` déclenche des `net.http_post` (spam push admin / flood réseau) ; `notify_late_deliveries` insère dans `admin_notifications`. → **vecteur d'abus/DoS non authentifié**.
   - *Correctif proposé (à valider)* :
     ```sql
     ALTER FUNCTION public.check_late_orders()          SET search_path = public;
     ALTER FUNCTION public.notify_late_deliveries()     SET search_path = public;
     ALTER FUNCTION public.trigger_late_delivery_push() SET search_path = public;
     REVOKE EXECUTE ON FUNCTION public.check_late_orders()          FROM anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.notify_late_deliveries()     FROM anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.trigger_late_delivery_push() FROM anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.set_order_arrival_at()       FROM anon, authenticated;
     ```
   (Ces fonctions doivent être appelées par **pg_cron / triggers** uniquement, jamais depuis l'API.)

**❌ F-06 (🟡)** — `trigger_late_delivery_push` contient une **URL placeholder** `.../functions/v1/NOM_DE_TA_FONCTION` (jamais remplacée) et lit `current_setting('app.settings.service_role_key', true)` pour la mettre en `Authorization: Bearer`. Fonction manifestement **laissée en état de brouillon**. Deux risques : (a) si un paramètre DB `app.settings.service_role_key` a été défini, la **clé service_role réside dans la config Postgres** (à vérifier/retirer) ; (b) fonction morte à supprimer.
  - *Action proposée* : `DROP FUNCTION public.trigger_late_delivery_push();` (après confirmation qu'aucun trigger actif ne l'utilise) et vérifier `SELECT current_setting('app.settings.service_role_key', true);` → doit être vide.

**Note advisor** : `get_advisors(security)` remonte aussi `check_max_5_addresses` en *search_path mutable* — c'est un **trigger** (pas exposé en RPC), donc risque moindre, mais à corriger pour cohérence (`ALTER FUNCTION public.check_max_5_addresses() SET search_path = public;`).
> À noter : ce trigger **prouve que la limite de 5 adresses est bien appliquée côté serveur** (contrairement à ce que supposait le catalogue de tests `test-cases-box.md`, cas BOX-ADDR-003 — à corriger).

### 2.c Écritures directes côté frontend (`.from(...).insert/update/delete/upsert`)

| Fichier:ligne | Table.op | Gouverné par | Verdict |
|---|---|---|---|
| `src/routes/_authenticated/panier.tsx:212` | `orders.insert` | RLS `orders_owner_insert` (`user_id=auth.uid`) + trigger zone | ⚠️ **F-02** `total` non revalidé |
| `src/routes/_authenticated/panier.tsx:230` | `order_items.insert` | RLS owner (jointure) | ⚠️ `unit_price` client |
| `src/routes/_authenticated/panier.tsx:248` | `order_item_options.insert` | RLS owner | ⚠️ `option_price` client |
| `src/routes/_authenticated/commande.$id.tsx:288` | `orders.update` (cancel) | RLS `orders_owner_cancel` (`pending→cancelled`) | ✅ bien gardé |
| `src/routes/_authenticated/admin.tsx` (accept/refuse/ready/delivered) | `orders.update` | RLS `orders_admin_update` (`has_role admin`) | ✅ RLS, pas qu'un `if` React |
| `src/components/DriverOrders.tsx` (delivering/delivered) | `orders.update` | RLS `orders_livreur_update` | ⚠️ **F-04** trop large |
| `src/routes/auth.tsx:43`, `CompteClient`, `complete-profile` | `profiles.update/upsert` | RLS `profiles_self_*` | ✅ |
| `src/components/AddAddress.tsx`, `CompteClient:208`, `complete-profile` | `addresses.insert/update/delete` | RLS own + trigger limite 5 | ✅ |
| `src/components/LastOrderReviewPopup.tsx:80` | `order_ratings.upsert` | RLS (voir **F-03**) | ❌ policy INSERT faible |
| `src/components/ReviewPopup.tsx:129,153` | `livreur_ratings.upsert` | RLS own + vérif commande | ✅ |
| `src/routes/_authenticated/admin/livreurs.tsx:94` | `livreurs.upsert` | RLS admin(ALL) | ✅ RLS |
| `src/routes/_authenticated/admin/menu.tsx:247/265/473/511` | `categories/menu_items/menu_item_sizes` | RLS admin(ALL) | ✅ RLS |
| `src/routes/_authenticated/admin/options.tsx:135/148/184/197` | `option_groups/option_items` | RLS admin(ALL) | ✅ RLS |

**❌ F-02 (🟠)** — La création de commande écrit `orders.total`, `order_items.unit_price`, `order_item_options.option_price` **directement depuis le client** (`panier.tsx`). La policy `orders_owner_insert` ne valide que `user_id=auth.uid()`, **pas le montant**. Un utilisateur peut donc, via appel PostgREST direct, créer une commande valide avec `total = 0` (ou tout prix arbitraire). Seule `distance_km` est recalculée serveur (trigger `enforce_delivery_zone`). → **intégrité financière / sous-facturation**.
  - *Correctif proposé (à valider)* : déplacer la création de commande dans une **RPC `SECURITY DEFINER`** `create_order(items jsonb, address_id uuid, promo text, instructions text)` qui : recalcule chaque `unit_price` depuis `menu_items`/`menu_item_sizes`/`option_items`, recalcule le sous-total, applique/valide le promo côté serveur (voir aussi éligibilité WELCOME10 non revalidée), fixe `total`, insère order+items+options **atomiquement** (résout aussi le problème d'atomicité relevé dans `test-cases-box.md`). Puis `REVOKE INSERT ON orders, order_items, order_item_options FROM authenticated` (ne plus autoriser l'insert direct).

**✅ Bon point** : toutes les actions admin (accepter/refuser/prête/livrée, gestion menu/options/livreurs) et livreur passent par des tables **protégées par RLS de rôle**, pas seulement par un `if (isAdmin)` masquant un bouton. L'annulation client est finement gardée par `orders_owner_cancel`.

---

## 3. Gardes de rôle — routing + serveur

### 3.a Route guards (TanStack `beforeLoad`)

| Route | Garde | Vérif serveur | Verdict |
|-------|-------|---------------|---------|
| `_authenticated/route.tsx` | session + email/phone confirmé | `supabase.auth.getUser()` | ✅ garde centralisée |
| `_authenticated/admin.tsx` | rôle admin (`user_roles ... role=admin`) | ✅ requête + RLS | ✅ |
| `_authenticated/dashboard.tsx:40` | rôle admin | ✅ requête `user_roles` | ✅ |
| `_authenticated/admin/livreur-stats.tsx:8` | `beforeLoad` présent | à confirmer (hérite `/admin` ? ) | ⚠️ vérifier qu'il exige bien admin |
| `_authenticated/driver.orders.tsx:8` | rôle livreur (`role=livreur`) | ✅ requête `user_roles` | ✅ |
| `_authenticated/driver.conversations.tsx` | `beforeLoad` présent | à confirmer | ⚠️ vérifier rôle livreur |
| `_authenticated/orders.$orderId.tracking.tsx` | connecté seulement | RLS + check statut composant | ✅ acceptable (données gardées par RLS) |
| `_authenticated/livreur.tsx` | redirige `/driver/orders` | — | ✅ |

**✅** Les zones sensibles (admin, dashboard, driver) ont une **double protection** : redirection au routing **ET** RLS sur les données/RPC sous-jacentes. La garde n'est jamais un simple `if` React.
**⚠️** Confirmer les gardes de `admin/livreur-stats.tsx`, `admin/menu.tsx`, `admin/options.tsx`, `admin/livreurs.tsx`, `driver.conversations.tsx` (les 4 pages admin nested héritent du `beforeLoad` de `/admin` via le nesting `_authenticated/admin/*` — à valider dans le `routeTree`), et de `livreur-stats` (défense défaillante seulement si RLS `livreur_stats` est laxiste — cf. §1).

### 3.b Edge Functions

| Fonction | Vérif identité/rôle | Verdict |
|----------|---------------------|---------|
| `delete-account` | ✅ identité = **JWT** (`auth.getUser(token)`), ignore tout `user_id` du body ; 401 si pas de token ; 405 hors POST | ✅ solide |
| `send-order-notification` | Webhook DB / appel direct ; lit via **service_role** ; pas de contrôle d'appelant | ⚠️ si exposée publiquement, un tiers peut déclencher des push (spam) en devinant un `order_id`. Vérifier qu'elle exige le secret webhook / JWT. |
| `notify-livreur`, `notify-admin-unassigned`, `notify-order-message` | déclenchées par triggers `pg_net` | ⚠️ mêmes remarques : confirmer qu'elles ne sont pas invocables sans secret |

**Recommandation** : pour toutes les Edge Functions déclenchées par `net.http_post` interne, exiger un en-tête secret partagé (ou vérifier le JWT service_role) et rejeter les appels externes.

### 3.c Actions sensibles re-vérifiées serveur ?

- Accepter/refuser/prête/livrée commande → ✅ RLS `orders_admin_update` / `orders_livreur_update`.
- Gérer menu/options/livreurs → ✅ RLS admin(ALL).
- Assignation livreur → ✅ RPC `admin_process_assignments` avec `has_role(admin)`.
- Export Excel (dépendances `xlsx`, `xlsx-js-style`) → **⚠️ à confirmer** : l'export est côté client et n'affiche que ce que la RLS autorise (donc pas de fuite au-delà des droits admin), mais vérifier que la **page d'export est bien sous garde admin** (probablement `dashboard`/`livreur-stats`).

---

## 4. Secrets & exposition

### 4.a `.gitignore` et suivi de `.env`

**❌ F-05 (🟠)** :
- Le `.gitignore` **n'ignore pas** `.env` (aucune ligne `.env`, seulement `*.local` et `.dev.vars`).
- `.env` **est suivi dans Git** (`git ls-files` le liste) et présent dans l'historique depuis le premier commit (`94ae24b`).
  - *Correctif proposé (à valider)* :
    ```bash
    printf '\n# Local env\n.env\n.env.*\n!.env.example\n' >> .gitignore
    git rm --cached .env
    git commit -m "chore: stop tracking .env"
    ```

### 4.b Contenu de `.env` (ce qui a été/est exposé)

Contenu actuel :
```
VITE_SUPABASE_URL / SUPABASE_URL                    → URL projet (non secret)
VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY → clé anon (JWT role=anon) — PUBLIQUE par design
VITE_VAPID_PUBLIC_KEY                                → clé VAPID publique (non secrète)
```
**✅** Aucune clé `service_role`, aucun secret Twilio, aucune clé VAPID **privée** dans `.env` ni ailleurs dans `src/`. Seules des valeurs **destinées au client** y figurent — leur exposition n'est pas une vulnérabilité de confidentialité *en soi* (la clé anon est de toute façon livrée au navigateur ; la sécurité repose sur la RLS).
**⚠️** L'historique montre une **rotation de la clé VAPID publique** (`ff730a91…` → `BKJVi0v1…`). L'ancienne valeur `ff730a91…` n'était pas un format VAPID valide (hex 32 octets) : rotation cosmétique, sans impact secret. Rien à roter côté secret.
**Recommandation** : ajouter un `.env.example` documentant les variables (sans valeurs), et confirmer que `service_role`, `VAPID_PRIVATE_KEY`, secrets SMS restent **uniquement** dans les *Supabase secrets* (Edge Functions).

### 4.c Edge Functions — usage des secrets

**✅** Toutes lisent leurs secrets via `Deno.env.get(...)` :
- `delete-account` : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `send-order-notification` : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- Aucune valeur secrète **hardcodée** trouvée dans `supabase/functions/`.

### 4.d CI / GitHub Actions

**✅ / ⚠️** : **aucun workflow** (`.github/` absent). Donc pas de secret en clair dans un YAML. Si une CI est ajoutée plus tard, utiliser **GitHub Secrets**.
**⚠️ F-06 (rappel)** : la seule occurrence inquiétante de « service_role » est **en base** (`trigger_late_delivery_push` → `current_setting('app.settings.service_role_key')`). Vérifier que ce paramètre DB n'est pas réellement positionné.

---

## 5. Gouvernance / dérive schéma (⚠️ F-11)

Le risque transversal : **l'état de sécurité réel n'est pas dans Git**. Exemples concrets de dérive constatée :
- `menu_items` (live) a des colonnes `image_url`, `is_available`, `is_featured`, `color`, `display_order`, tables `menu_item_sizes`/`option_*` — **absentes de la migration** `20260712091500` (qui définit `is_active`, `position`, `sizes jsonb`).
- Les policies « Public read … » (menu), « Users can insert their own ratings » (faible), les 3 fonctions late-delivery, `check_max_5_addresses`, les buckets `avatars`/`dish-images`/`menu-images` : **créés hors migrations**.
- Conséquence : une revue de code sur `supabase/migrations/` **ne voit pas** F-01, F-03, F-07, F-08.

**Recommandation forte** : régénérer une migration de référence à partir de la base live (`supabase db pull` / `pg_dump --schema-only`), la committer, et **désormais faire passer tout changement de schéma/policy par une migration versionnée** plutôt que par l'éditeur Lovable.

---

## 6. Divers (advisor Supabase)

- **F-08 (🟡)** Buckets **publics** `avatars`, `dish-images`, `menu-images` avec policy SELECT large → un client peut **lister** tous les fichiers. Pour de l'imagerie menu/avatars c'est peu sensible, mais restreindre la policy au strict accès par URL d'objet (pas de `list`) est recommandé. (`address-photos` est correctement **privé** ✅.)
- **F-10 (🟡)** Auth : **protection mots de passe compromis (HaveIBeenPwned) désactivée**. À activer (utile pour `/reset-password`). Envisager aussi le renforcement de la politique de mot de passe.
- Rappel : `favorites` référencée par `delete-account` n'existe pas en base → suppression best-effort silencieuse (sans impact).

---

## 7. Plan de correctifs proposé (par priorité) — **à valider avant application**

1. **🔴 F-01** — `SET search_path = public` + `REVOKE EXECUTE ... FROM anon, authenticated` sur `check_late_orders`, `notify_late_deliveries`, `trigger_late_delivery_push`, `set_order_arrival_at`.
2. **🟠 F-02** — RPC `create_order` (recalcul serveur du `total`/prix + insert atomique) ; `REVOKE INSERT` direct sur `orders`/`order_items`/`order_item_options`.
3. **🟠 F-03** — Renforcer la policy INSERT `order_ratings` (vérif propriété commande).
4. **🟠 F-04** — Restreindre `orders_livreur_update` aux transitions légitimes (ou RPC dédiée).
5. **🟠 F-05** — Ignorer + dé-tracker `.env`.
6. **🟡 F-06** — Supprimer/corriger `trigger_late_delivery_push` ; vérifier `app.settings.service_role_key`.
7. **🟡 F-07** — Trancher `admin_notifications` (policy admin SELECT ou statu quo assumé).
8. **🟡 F-08 / F-09 / F-10** — Restreindre listing buckets publics ; `REVOKE` des privilèges non couverts par policy (`user_roles`, DELETE/TRUNCATE) ; activer la protection mots de passe compromis.
9. **⚠️ F-11** — Rapatrier le schéma live dans des migrations versionnées.

---

_Rapport produit par introspection combinée (migrations Git + base Supabase live + advisor + revue `src/`). Aucun correctif appliqué. En attente de validation pour engager le plan §7._
