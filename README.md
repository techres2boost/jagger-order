# BOX — commande et livraison de restaurant

Application web (packagée en mobile via Capacitor) pour le restaurant **BOX** :
consultation du menu, panier, passage de commande, suivi de livraison en temps
réel, back-office administrateur et application livreur.

**Pas de paiement en ligne** : les commandes sont réglées à la livraison.

- Production : <https://box-bite-order.lovable.app/>
- Projet Supabase : `ssmmstetcmgsjnjbjkat` (région `eu-central-2`, Postgres 17)

> Ce dépôt est connecté à [Lovable](https://lovable.dev). Les commits poussés sur
> la branche connectée sont resynchronisés dans l'éditeur : **ne jamais réécrire
> l'historique publié** (pas de `push --force`, `rebase`, `amend` ni `squash` sur
> des commits déjà poussés). Voir `AGENTS.md`.

---

## 1. Pile technique

| Domaine       | Choix                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Framework     | **TanStack Start** (React 19) — *pas* Next.js                          |
| Routeur       | TanStack Router (routage par fichiers, `src/routes/`)                  |
| Build         | Vite 8 + Nitro (cible Cloudflare Workers)                              |
| Langage       | TypeScript en mode `strict`                                            |
| UI            | Tailwind CSS 4 + shadcn/ui (Radix)                                     |
| Données       | Supabase — Postgres, Auth, Storage, Realtime, Edge Functions           |
| Cartographie  | Leaflet + React-Leaflet (tuiles OpenStreetMap, géocodage Nominatim)     |
| Graphiques    | Recharts (chargé en différé)                                           |
| Export Excel  | `xlsx-js-style` (chargé en différé)                                    |
| Tests         | Vitest                                                                 |
| Mobile        | Capacitor (Android / iOS)                                              |

> ⚠️ **Ce n'est pas une application Next.js.** Il n'existe ni App Router, ni
> Server Components, ni Server Actions, ni `next/image`. Les conventions
> équivalentes sont décrites dans `src/routes/README.md` et `ARCHITECTURE.md`.

---

## 2. Démarrage

```bash
npm ci                 # installation reproductible depuis le lockfile
cp .env.example .env   # puis renseigner les valeurs (voir §3)
npm run dev            # serveur de développement
```

### Scripts

| Commande                | Rôle                                                     |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Serveur de développement Vite                            |
| `npm run build`         | Build de production (sortie Nitro dans `.output/`)       |
| `npm run preview`       | Prévisualisation du build                                |
| `npm run typecheck`     | `tsc --noEmit`                                           |
| `npm test`              | Suite Vitest (une passe)                                 |
| `npm run test:watch`    | Vitest en mode watch                                     |
| `npm run lint`          | ESLint (voir la note sur le formatage ci-dessous)        |
| `npm run format`        | Prettier en écriture                                     |

> **Note sur `npm run lint`** : le dépôt comporte encore environ 855 erreurs de
> formatage Prettier préexistantes. Le job `lint` de la CI est donc
> **volontairement non bloquant**. Pour assainir : lancer `npm run format` dans
> un commit isolé (ne contenant *que* du reformatage), puis retirer le
> `continue-on-error` du job `lint` dans `.github/workflows/ci.yml`.

---

## 3. Variables d'environnement

Toutes les variables préfixées `VITE_` sont **injectées dans le bundle client**
et donc **publiques**. Aucun secret ne doit jamais porter ce préfixe.

### Client (publiques par conception)

| Variable                        | Rôle                                                     |
| ------------------------------- | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL du projet Supabase                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anon/publishable — la sécurité repose sur la **RLS** |
| `VITE_VAPID_PUBLIC_KEY`         | Clé VAPID publique (`pushManager.subscribe`)             |

### Serveur (SSR / server functions)

| Variable                     | Rôle                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `SUPABASE_URL`               | Idem, côté serveur                                    |
| `SUPABASE_PUBLISHABLE_KEY`   | Utilisée par le middleware d'authentification         |
| `SUPABASE_SERVICE_ROLE_KEY`  | 🔴 **SECRET** — contourne la RLS. Jamais côté client. |

### Secrets des Edge Functions

Configurés dans le dashboard Supabase (Settings → Edge Functions → Secrets),
jamais dans le dépôt : `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, et la clé interne lue via `internal_secret()`.

**Pourquoi `src/integrations/supabase/client.ts` contient des valeurs de repli :**
l'URL et la clé publiable y sont codées en dur comme repli lorsque
l'environnement n'est pas fourni au build (cas Lovable Cloud sans connecteur).
Ce ne sont pas des secrets — elles sont de toute façon livrées au navigateur. Ne
**jamais** appliquer ce motif à `SUPABASE_SERVICE_ROLE_KEY`.

---

## 4. Rôles et habilitations

Quatre profils, portés par la table `user_roles` (enum `app_role`) :

| Rôle       | Accès                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| *(anon)*   | Menu public en lecture seule, site vitrine                              |
| `client`   | Ses commandes, ses adresses, ses avis, le chat de sa livraison en cours |
| `livreur`  | Les commandes qui lui sont assignées, le chat, ses statistiques         |
| `admin`    | Toutes les commandes, le menu, les livreurs, le tableau de bord         |

`user_roles` **n'a aucune policy d'écriture** : l'auto-attribution de rôle est
impossible via l'API. L'attribution se fait en base (service_role / dashboard).

La table est protégée par RLS sur les 20 tables du schéma `public`, et
`has_role()` est une fonction `SECURITY DEFINER` à `search_path` figé.

---

## 5. Base de données et migrations

Les migrations vivent dans `supabase/migrations/` (48 fichiers, ordre
chronologique par préfixe `YYYYMMDDHHMMSS`).

```bash
# Appliquer les migrations au projet distant
supabase db push

# Régénérer les types TypeScript après un changement de schéma
supabase gen types typescript --project-id ssmmstetcmgsjnjbjkat \
  > src/integrations/supabase/types.ts
```

> ⚠️ **Dérive de schéma.** Historiquement, plusieurs tables, policies et
> fonctions ont été créées directement via l'éditeur Lovable Cloud, sans passer
> par une migration : le dossier `supabase/migrations/` ne reflétait donc pas
> l'état réel de la base. Toute modification de schéma doit désormais passer par
> une migration versionnée, faute de quoi la sécurité réelle du projet devient
> invérifiable depuis Git. Voir `AUDIT.md`, section Gouvernance.

Voir `ARCHITECTURE.md` pour le schéma détaillé, les RPC et les déclencheurs.

---

## 6. Tests

```bash
npm test
```

La suite couvre la logique métier pure et les gardes de sécurité :

- `src/lib/geo.test.ts` — zone de livraison. Les distances de référence ont été
  **calculées par Postgres** avec la formule du déclencheur
  `enforce_delivery_zone`, puis figées : toute divergence entre la règle client
  et la règle serveur casse la suite. Couvre aussi le comportement
  *fail-closed* (coordonnées absentes ⇒ hors zone).
- `src/lib/order-timing.test.ts` — estimations de préparation et de livraison.

**Non couvert (dette assumée)** : aucun test de composant, aucun test E2E,
aucun test automatisé des policies RLS. La vérification RLS de cet audit a été
menée manuellement via une matrice d'accès (voir `AUDIT.md`) ; l'automatiser est
la recommandation de test la plus rentable.

---

## 7. Déploiement

- **Hébergement** : build Nitro (`.output/`), cible Cloudflare Workers.
- **Déploiement** : automatique via Lovable sur la branche connectée. La CI
  (`.github/workflows/ci.yml`) valide typecheck + tests + build à chaque push et
  pull request.
- **Base de données** : les migrations ne sont pas jouées automatiquement —
  `supabase db push` reste une étape manuelle et **doit précéder** le déploiement
  applicatif quand le code dépend d'un nouveau schéma.
- **Rollback** : revert du commit puis redéploiement. ⚠️ Les migrations n'ont pas
  de script de retour arrière (`down`) : un rollback applicatif ne défait pas un
  changement de schéma.

### En-têtes de sécurité

Ils sont appliqués à **toutes** les réponses par `src/server.ts` : CSP avec nonce
par requête (pas de `script-src 'unsafe-inline'`), HSTS `preload`,
`X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`. `src/server.ts` est la **source de vérité unique** de la
CSP — ne pas rajouter de `<meta http-equiv>` concurrente.

---

## 8. Dépannage

| Symptôme                                          | Piste                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `Missing Supabase environment variable(s)`        | `.env` absent ou incomplet (§3)                                       |
| Requête qui renvoie 0 ligne sans erreur           | Comportement normal de la RLS : l'utilisateur n'y a pas accès         |
| `permission denied for table X`                   | GRANT manquant (distinct d'un refus RLS, qui renvoie 0 ligne)         |
| `Adresse hors de la zone de livraison`            | Déclencheur `enforce_delivery_zone` — rayon de 7 km                    |
| `Adresse de livraison sans coordonnées`           | Idem, comportement *fail-closed* voulu                                |
| Historique admin incomplet                        | Plafonné à 200 lignes, un bandeau le signale — affiner les filtres     |
| Types TS en désaccord avec la base                | Régénérer `types.ts` (§5)                                             |
| `npm run lint` en échec                           | Formatage Prettier préexistant (§2)                                   |

---

## 9. Documents associés

| Fichier                 | Contenu                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `ARCHITECTURE.md`       | Schéma de base, RPC, déclencheurs, flux métier, découpage front |
| `AUDIT.md`              | Audit de production : constats classés et correctifs appliqués |
| `security-audit-box.md` | Audit de sécurité antérieur (constats F-01 à F-11)             |
| `test-cases-box.md`     | Scénarios de test fonctionnels (manuels)                       |
| `src/routes/README.md`  | Conventions de routage TanStack                                |
| `AGENTS.md`             | Contraintes liées à la synchronisation Lovable                 |
