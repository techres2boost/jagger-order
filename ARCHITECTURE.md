# Architecture — BOX

Document de référence technique. Voir `README.md` pour l'installation et
`AUDIT.md` pour l'état de production.

---

## 1. Vue d'ensemble

```
                        ┌──────────────────────────────┐
   Navigateur / App     │  TanStack Start (React 19)   │
   Capacitor            │  SSR + hydratation, Vite     │
                        └───────────┬──────────────────┘
                                    │
                     ┌──────────────┴───────────────┐
                     │  src/server.ts               │  En-têtes de sécurité,
                     │  (entrée Nitro / Workers)    │  CSP à nonce, page d'erreur
                     └──────────────┬───────────────┘
                                    │
        ┌───────────────────────────┼────────────────────────────┐
        │                           │                            │
┌───────▼────────┐        ┌─────────▼──────────┐      ┌──────────▼─────────┐
│ PostgREST      │        │ Realtime           │      │ Edge Functions     │
│ (RLS = garde)  │        │ (canaux `orders`)  │      │ (push, suppression │
└───────┬────────┘        └─────────┬──────────┘      │  de compte)        │
        │                           │                 └──────────┬─────────┘
        └───────────────┬───────────┴────────────────────────────┘
                        │
                ┌───────▼────────────────────────────┐
                │  PostgreSQL 17                     │
                │  RLS sur les 20 tables `public`    │
                │  RPC SECURITY DEFINER + triggers   │
                └────────────────────────────────────┘
```

**Principe directeur : la base est la frontière de sécurité.** Le client parle
directement à PostgREST avec la clé publiable ; il n'existe pas de couche API
maison à traverser. Toute règle d'autorisation doit donc être exprimée en RLS ou
dans une RPC `SECURITY DEFINER` — **jamais uniquement dans le composant React**,
qui est contournable via les devtools ou un appel HTTP direct.

---

## 2. Découpage du front

| Chemin                        | Rôle                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `src/routes/`                 | Routage par fichiers. `_authenticated/` = segment protégé      |
| `src/routes/__root.tsx`       | Coquille applicative (thème, panier, service worker)          |
| `src/components/`             | Composants métier                                             |
| `src/components/ui/`          | shadcn/ui — **généré**, à ne pas modifier à la main           |
| `src/components/dashboard/`   | Blocs du tableau de bord chargés en différé                   |
| `src/lib/`                    | Logique métier pure et contextes React                        |
| `src/integrations/supabase/`  | Clients et middlewares Supabase — **fichiers générés**        |
| `src/data/menu.ts`            | Menu statique de repli (le menu réel vient de la base)        |
| `supabase/migrations/`        | Schéma versionné (48 migrations)                              |
| `supabase/functions/`         | 6 Edge Functions Deno                                         |

### Les trois clients Supabase

Distinction essentielle — les confondre est une faille :

| Fichier                | Clé              | RLS         | Usage                                    |
| ---------------------- | ---------------- | ----------- | ---------------------------------------- |
| `client.ts`            | publishable      | ✅ appliquée | Navigateur (import par défaut)            |
| `auth-middleware.ts`   | publishable + JWT| ✅ appliquée | Server functions au nom de l'utilisateur  |
| `client.server.ts`     | **service_role** | ❌ contournée | Serveur uniquement, opérations de confiance |

`client.server.ts` ne doit être importé que depuis un module `*.server.ts` ou via
`await import()` dans un handler serveur : un import au niveau supérieur d'un
fichier de route embarquerait la clé de service dans le bundle client.

### Protection des routes

`src/routes/_authenticated/route.tsx` exécute un `beforeLoad` qui vérifie la
session et la confirmation du compte. Les routes admin (`dashboard`, `admin/*`)
et livreur (`driver.*`) ajoutent leur propre contrôle de rôle.

Ces gardes relèvent de l'**ergonomie** (rediriger plutôt qu'afficher un écran
vide), **pas de la sécurité** : la protection réelle est la RLS. Un utilisateur
qui contournerait la redirection verrait une page sans données.

---

## 3. Schéma de la base

### Commandes

| Table                | Rôle                                                        |
| -------------------- | ----------------------------------------------------------- |
| `orders`             | Commande. Statut, totaux, horodatages, livreur assigné      |
| `order_items`        | Lignes de commande (nom, taille, quantité, prix unitaire)   |
| `order_item_options` | Options par ligne (suppléments, retraits)                   |
| `order_ratings`      | Avis sur la commande (1 par commande, contrainte unique)     |
| `order_messages`     | Chat client ↔ livreur, limité à la livraison en cours       |

### Menu (lecture publique)

`categories` → `menu_items` → `menu_item_sizes`, et
`option_groups` → `option_items`, reliés par `menu_item_option_groups`.

Lecture `USING (true)` pour `anon` + `authenticated` ; écriture réservée aux
admins.

### Personnes

| Table                | Rôle                                                    |
| -------------------- | ------------------------------------------------------- |
| `profiles`           | 1‑1 avec `auth.users` (créé par `handle_new_user`)      |
| `user_roles`         | Rôles. **Aucune policy d'écriture** (pas d'escalade)    |
| `addresses`          | Adresses client (max 5, coordonnées obligatoires)       |
| `livreurs`           | Livreurs, reliés à `auth.users` via `user_id`           |
| `livreur_ratings`    | Avis sur le livreur                                     |
| `livreur_stats`      | **Vue** `security_invoker=on` (agrégats par livreur)    |

### Technique

`app_settings` (durée de préparation), `admin_notifications` (retards),
`push_subscriptions` (abonnements Web Push), `internal_config` (secrets internes,
**RLS active sans aucune policy** ⇒ `service_role` exclusivement, lu par
`internal_secret()`).

### Statuts de commande

```
pending ──► accepted ──► ready ──► delivering ──► delivered
   │            │
   ├─► refused  └─► (admin peut refuser)
   ├─► expired   (expiration automatique, expire_stale_orders)
   └─► cancelled (annulation par le client, uniquement depuis `pending`)
```

---

## 4. RPC `SECURITY DEFINER`

Toutes ont un `search_path` figé (protection contre le détournement de
`search_path`).

| Fonction                      | Appelable par   | Rôle                                            |
| ----------------------------- | --------------- | ----------------------------------------------- |
| `create_order_secure`         | `authenticated` | **Crée la commande. Recalcule tous les prix.**  |
| `livreur_update_order_status` | `authenticated` | Transitions de statut autorisées au livreur     |
| `admin_dashboard_stats`       | `authenticated` | Agrégats du tableau de bord (garde admin)       |
| `admin_order_filters`         | `authenticated` | Valeurs des filtres admin (garde admin)         |
| `admin_process_assignments`   | `authenticated` | Relance l'affectation d'un livreur (garde admin)|
| `save_push_subscription`      | `authenticated` | Enregistre un abonnement push (force `user_id`) |
| `has_role`                    | `authenticated` | Test de rôle, utilisé par les policies          |
| `can_access_order_chat`       | `authenticated` | Participant d'une livraison en cours            |
| `shares_active_delivery`      | `authenticated` | Idem, pour la lecture de `profiles`             |
| `get_order_livreur`           | `authenticated` | Livreur assigné (exposition minimale)           |
| `expire_stale_orders`         | `authenticated` | Passe les `pending` échues à `expired`          |
| `process_delivery_assignments`| *(interne)*     | Boucle d'affectation (cron)                     |
| `check_late_orders`, `notify_late_deliveries`, `trigger_late_delivery_push` | *(interne)* | Détection des retards |

### `create_order_secure` — pourquoi c'est central

Le client **n'envoie aucun prix** : uniquement des références (article, taille,
options), la quantité, la note, l'adresse et le code promo. La fonction
recalcule le sous-total depuis le menu en base, applique la remise et fige
`orders.total`. C'était le correctif du constat **F‑02** : auparavant le client
écrivait `orders.total` directement et pouvait donc commander à 0 TND.

> Le code promo `WELCOME10` n'est concédé par le serveur qu'à la **première**
> commande réelle, alors que le panier l'affiche sans condition. Le montant
> facturé est toujours celui du serveur — mais l'affichage peut différer. Voir
> `AUDIT.md`.

---

## 5. Déclencheurs

| Table                | Déclencheur                        | Effet                                              |
| -------------------- | ---------------------------------- | -------------------------------------------------- |
| `orders`             | `trg_orders_enforce_delivery_zone` | BEFORE INSERT — rejette hors zone, fixe `distance_km` |
| `orders`             | `trg_order_status_notify`          | AFTER INSERT — push de changement de statut         |
| `orders`             | `trg_order_livreur_assigned`       | AFTER UPDATE — prévient le livreur assigné          |
| `orders`             | `trg_set_arrival_at`               | BEFORE UPDATE — calcule l'heure d'arrivée           |
| `orders`, `profiles` | `set_updated_at`                   | BEFORE UPDATE — horodatage                          |
| `addresses`          | `enforce_max_5_addresses`          | BEFORE INSERT — plafonne à 5 adresses               |
| `order_messages`     | `trg_order_message_notify`         | AFTER INSERT — push au destinataire du chat         |
| `push_subscriptions` | `push_subscriptions_enforce_role`  | BEFORE INSERT — valide le rôle déclaré              |
| `admin_notifications`| `on_late_delivery_notification`    | AFTER INSERT — push retard aux admins               |

### Zone de livraison — règle dupliquée volontairement

La contrainte des 7 km est appliquée **deux fois** :

- `src/lib/geo.ts` — retour immédiat dans l'UI ;
- `enforce_delivery_zone()` — garde réelle, non contournable.

Les deux implémentations partagent les mêmes constantes (coordonnées du
restaurant, rayon de 7 km, rayon terrestre de 6371 km) et la même formule de
Haversine. `src/lib/geo.test.ts` verrouille cette parité contre des distances
calculées par Postgres : **toute modification doit toucher les deux côtés dans le
même commit.** Les deux sont *fail-closed* (coordonnées absentes ⇒ refus).

---

## 6. Edge Functions

| Fonction                     | `verify_jwt` | Déclenchée par             |
| ---------------------------- | ------------ | -------------------------- |
| `send-order-notification`    | ❌           | Trigger base (pg_net)      |
| `notify-livreur`             | ❌           | Trigger base               |
| `notify-order-message`       | ❌           | Trigger base               |
| `notify-admin-late-delivery` | ❌           | Trigger base               |
| `notify-admin-unassigned`    | ❌           | Trigger / cron             |
| `delete-account`             | ✅           | Utilisateur (RGPD)         |

`verify_jwt = false` est nécessaire pour les fonctions appelées par la base via
`pg_net` (aucun JWT utilisateur dans ce contexte). Elles ne sont donc protégées
que par le secret partagé lu via `internal_secret()` — **toute nouvelle fonction
sans JWT doit vérifier ce secret**, sinon elle est ouverte publiquement.

---

## 7. Temps réel et notifications

- **Realtime** : le client s'abonne aux changements de `orders` (suivi de
  commande, écran admin, écran livreur). Les événements ne portent que des
  lignes que la RLS autorise à voir.
- **Web Push** : `push_subscriptions` + VAPID. L'envoi est fait par les Edge
  Functions, jamais par le client (la clé privée VAPID reste serveur).
- **Position du livreur** : `DriverBroadcastProvider` diffuse la position via un
  canal Realtime pendant la livraison. Monté dans le layout authentifié,
  inactif pour les comptes non‑livreur.

---

## 8. Performance — décisions structurantes

| Décision                                                | Raison                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `(select auth.uid())` dans **toutes** les policies      | Hisse l'appel en InitPlan : évalué 1×/requête, non 1×/ligne    |
| Une seule policy `SELECT` par table (expression `OR`)   | Évite d'évaluer N policies par ligne                          |
| `xlsx-js-style` en `import()` dynamique                  | ~1 Mo retiré du chunk de la route admin                        |
| `RatingCharts` en `React.lazy`                           | ~515 Ko (recharts) hors du premier rendu                      |
| Pagination keyset dans `commandes.tsx`                   | Coût constant quel que soit le volume                         |
| `HISTORY_LIMIT` dans `admin.tsx`                         | Borne la requête sous le `statement_timeout` de 8 s            |
| `admin_dashboard_stats` (agrégats en base)                | Évite de rapatrier `orders`/`order_items` en entier            |

### Budget de requête

Le rôle `authenticated` a un `statement_timeout` de **8 s** (`anon` : 3 s).
Toute requête non bornée finira par dépasser cette limite à mesure que `orders`
grossit : **toujours borner** (`.limit()` ou pagination keyset).

---

## 9. Limite structurelle : mono-restaurant

L'application est conçue pour **un seul établissement**. Il n'existe aucune
notion de locataire : pas de table `restaurants`, pas de colonne `restaurant_id`,
et les coordonnées du restaurant sont des **constantes** dans `src/lib/geo.ts` et
dans `enforce_delivery_zone()`.

L'isolation actuelle se fait **par utilisateur** (`auth.uid()`), ce qui est
correct et vérifié, mais ce n'est pas de la multi-location. Servir plusieurs
restaurants exigerait :

1. une table `restaurants` et une colonne `restaurant_id` sur toutes les tables
   métier ;
2. la réécriture des ~30 policies pour croiser l'appartenance au locataire ;
3. le passage des constantes géographiques en données par restaurant ;
4. des index composites préfixés par `restaurant_id`.

C'est une refonte de fond, à décider explicitement — pas une évolution
incrémentale. Voir `AUDIT.md`.
