# Jagger — reconstruction du backend Supabase

Ces scripts recréent l'intégralité du backend sur le projet Supabase **vierge**
de Jagger (`zouvaqadidzeieytanoa`). Ils ont été générés depuis le schéma **live**
du projet de référence (BOX), et non depuis `supabase/migrations/` : cet
historique ne couvre que 9 des 20 tables, le reste ayant été créé via l'UI.

> Les migrations existantes dans `supabase/migrations/` sont conservées telles
> quelles pour l'historique. **Ne les rejouez pas** sur le nouveau projet :
> `01_schema.sql` est le point d'entrée complet et suffisant.

## Ordre d'exécution

| # | Fichier | Contenu |
|---|---|---|
| 1 | `01_schema.sql` | extensions, types ENUM, 20 tables, contraintes, index, 26 fonctions, 12 triggers, RLS + 60 policies, privilèges, Realtime, 3 buckets Storage + policies, jobs pg_cron |
| 2 | `02_seed_config.sql` | `push_trigger_secret` + `prep_time_minutes` |
| 3 | `03_seed_menu.sql` | 22 catégories, 121 plats, 121 prix, 8 « featured », 1 groupe d'options (9 choix) — **généré**, cf. plus bas |

Depuis le SQL Editor du dashboard Supabase, ou :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap/01_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap/02_seed_config.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap/03_seed_menu.sql
```

Les trois scripts sont **idempotents** (ré-exécutables sans erreur).

## Avant d'exécuter `02_seed_config.sql`

Remplacez `__REPLACE_WITH_UNIQUE_PUSH_SECRET__` par un secret propre à ce
projet — **jamais** celui de BOX ni d'un autre client :

```bash
openssl rand -base64 32
```

Ne committez pas la vraie valeur.

## Ensuite : Edge Functions

Déployez les 6 fonctions de `supabase/functions/` :

```bash
supabase functions deploy send-order-notification notify-livreur \
  notify-order-message notify-admin-late-delivery notify-admin-unassigned \
  delete-account --project-ref zouvaqadidzeieytanoa
```

Puis posez leurs secrets (Dashboard → Edge Functions → Secrets) :

| Secret | Valeur |
|---|---|
| `SUPABASE_URL` | `https://zouvaqadidzeieytanoa.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role du projet |
| `VAPID_PUBLIC_KEY` | clé publique VAPID **générée pour Jagger** |
| `VAPID_PRIVATE_KEY` | clé privée VAPID correspondante |
| `PUSH_TRIGGER_SECRET` | **exactement** la valeur mise dans `internal_config.push_trigger_secret` |

Générer une paire VAPID dédiée (ne jamais réutiliser celle d'un autre
restaurant, FCM rejetterait les push) :

```bash
npx web-push generate-vapid-keys
```

La clé **publique** va aussi dans `VITE_VAPID_PUBLIC_KEY` côté front (`.env` /
variables d'environnement Lovable). Sans elle, les push sont simplement
désactivés : le reste de l'application fonctionne.

## Auth

- **Téléphone (OTP)** : Dashboard → Auth → Phone → fournisseur Twilio Verify
  propre à Jagger.
- **Google OAuth** : créez des identifiants dans Google Cloud Console, puis
  Dashboard → Auth → Providers → Google. Ajoutez le callback
  `https://zouvaqadidzeieytanoa.supabase.co/auth/v1/callback` et renseignez
  Site URL + Redirect URLs avec le domaine de production.

## Attribution des rôles (SQL uniquement)

`user_roles` n'a **aucune policy d'écriture** et les GRANT d'écriture sont
révoqués : personne ne peut se promouvoir admin depuis l'application. Les rôles
se donnent exclusivement en SQL, après que la personne se soit inscrite une
première fois :

```sql
insert into public.user_roles (user_id, role) values ('<uuid>', 'admin');
insert into public.user_roles (user_id, role) values ('<uuid>', 'livreur');
insert into public.livreurs (user_id, nom, telephone, email)
  values ('<uuid>', 'Nom Livreur', '20000000', 'livreur@exemple.tn');
```

À l'inscription, `handle_new_user()` rattache automatiquement le compte à une
fiche `livreurs` existante si l'email correspond, et lui donne le rôle
`livreur` ; sinon le rôle `client`.

## Images des plats

Le seed SQL ne pose **pas** les images (le sandbox d'automatisation ne peut pas
joindre `*.supabase.co`, et `storage.objects` n'est pas modifiable en SQL). Voir
`scripts/README-menu-seed.md`.

## Régénérer le seed du menu

`03_seed_menu.sql` et `menu/manifest.json` sont générés depuis l'unique source
de vérité `src/data/menu.ts` :

```bash
node scripts/generate-menu-seed.mjs
```

Le script échoue si un plat référence une catégorie inconnue, un doublon
nom+catégorie, un prix invalide, un groupe d'options inexistant ou une image
absente du dépôt.

## Vérifications post-installation

```sql
-- 22 / 121 / 121 / 8 / 1 / 9
select (select count(*) from categories)      as categories,
       (select count(*) from menu_items)      as plats,
       (select count(*) from menu_item_sizes) as prix,
       (select count(*) from menu_items where is_featured) as featured,
       (select count(*) from option_groups)   as groupes_options,
       (select count(*) from option_items)    as choix_options;

-- 3 buckets, RLS et limites en place
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- 3 jobs cron actifs
select jobname, schedule from cron.job;

-- pg_net et pg_cron activés (sinon : aucune notification push)
select extname from pg_extension where extname in ('pg_net','pg_cron');
```

## Point d'attention repris du projet de référence

`check_late_orders()` est recréée à l'identique mais **son job cron n'est pas
planifié** : elle est déjà cassée côté BOX (elle lit `orders.order_number`, une
colonne qui n'existe pas, et appelle l'Edge Function `send-push-notification`,
jamais déployée). La détection de retard réellement active est
`notify_late_deliveries()`, planifiée toutes les minutes. Réactivez le job
seulement après correction de la fonction.
