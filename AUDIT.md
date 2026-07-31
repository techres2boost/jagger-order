# Audit de production — BOX

**Date** : 2026-07-30 · **Périmètre** : dépôt complet (`src/`, `supabase/`,
outillage) **+ introspection de la base live** (`ssmmstetcmgsjnjbjkat`).

**Méthode** : lecture du code, introspection Postgres (`pg_policies`, `pg_proc`,
`pg_trigger`, `storage.buckets`, advisors Supabase), build de production mesuré,
et **vérification empirique des autorisations** — matrice d'accès sur 20 tables ×
4 profils, plus une batterie de tests négatifs (IDOR, escalade de rôle,
transitions de statut) exécutés directement en base sous chaque rôle.

---

## 0. Deux rectifications de cadrage

Le brief de la mission décrivait un projet différent de celui du dépôt. Deux
écarts changent la nature des recommandations, ils sont donc énoncés d'emblée.

### 0.1 Ce n'est pas Next.js

Le brief demandait d'auditer App Router, Server Components, Server Actions, ISR,
`next/image`, metadata… **Aucun de ces éléments n'existe ici.** Le projet est
bâti sur **TanStack Start + Vite 8 + Nitro**. Les sections correspondantes ont
été traitées via leurs équivalents réels : routage par fichiers TanStack,
`beforeLoad`, RPC de server functions, découpage de bundle Vite/Rolldown, en-têtes
et CSP dans `src/server.ts`.

### 0.2 Ce n'est pas une application multi-restaurants

Le brief parle de « milliers de restaurants », de « cartes de fidélité » et d'un
« Super Admin », et cite le dépôt `Digital_Fidelity`. Le dépôt audité est une
application de **commande et livraison pour un établissement unique** (« BOX »).

Constat vérifié en base : **aucune table `restaurants`, aucune colonne
`restaurant_id`**, et les coordonnées du restaurant sont des constantes en dur
(`src/lib/geo.ts`, `enforce_delivery_zone()`). Il n'y a pas de fidélité ni de
Super Admin.

**Conséquence directe** : la demande « aucun restaurant ne doit accéder aux
données d'un autre » **est sans objet en l'état** — il n'y a pas de frontière de
locataire à protéger. L'isolation réellement en place, et vérifiée par cet audit,
est **par utilisateur** (`auth.uid()`). Passer au multi-restaurants est une
refonte de schéma, chiffrée en §7, et non un durcissement de l'existant. Je n'ai
pas engagé cette refonte : elle changerait la nature du produit et relève d'une
décision explicite.

Tout le reste de l'audit porte sur l'application réelle.

---

## 1. Verdict

Le projet est **plus sain que sa taille ne le laisse craindre** sur le plan de la
sécurité applicative : RLS active sur les 20 tables, aucune escalade de rôle
possible, totaux de commande recalculés en base, en-têtes de sécurité complets
avec CSP à nonce, secrets serveur correctement cloisonnés. Un audit de sécurité
antérieur (`security-audit-box.md`, constats F‑01 à F‑11) a été **effectivement
appliqué** — j'ai vérifié chaque correctif en base, ils tiennent.

Les faiblesses réelles étaient ailleurs : **scalabilité de la couche RLS**,
**absence totale de CI et de tests**, **poids du bundle admin**, et **une requête
non bornée** qui aurait cassé l'écran admin en croissant.

| Axe                | Avant        | Après        |
| ------------------ | ------------ | ------------ |
| Sécurité           | 🟢 Bon        | 🟢 Bon (+3 correctifs) |
| Scalabilité        | 🔴 Bloquant   | 🟢 Bon        |
| Performance        | 🟠 Moyen      | 🟢 Bon        |
| Maintenabilité     | 🟠 Moyen      | 🟡 Correct    |
| Tests / CI         | 🔴 Inexistant | 🟡 Socle en place |
| Documentation      | 🔴 Inexistante| 🟢 Bon        |

---

## 2. Correctifs appliqués

Six commits, chacun isolé et vérifié.

### C‑1 🔴 RLS réévaluée par ligne — le plafond de scalabilité

**Constat.** Sur les **54 policies** du schéma, **aucune** n'encapsulait
`auth.uid()` ni `has_role()` dans un sous-select. Postgres traitait donc ces
appels comme dépendants de la ligne et les réévaluait **une fois par ligne
scannée**. Le coût de la RLS croissait avec le **volume total de la table**, pas
avec le nombre de lignes retournées.

S'y ajoutaient **49 cas de policies permissives multiples** : trois policies
`SELECT` sur `orders` étaient toutes évaluées par ligne, puis combinées par `OR`.

**Pourquoi c'était le point le plus grave.** `orders` et `order_items` sont les
seules tables à croissance illimitée. Avec le `statement_timeout` de 8 s du rôle
`authenticated`, cette dette se traduisait par une panne à terme, pas par une
lenteur : au-delà de quelques dizaines de milliers de commandes, l'historique
client cesse simplement de répondre.

**Correctif** : encapsulation en `(select …)` pour hisser l'expression en
InitPlan (évaluée 1×/requête), fusion des policies `SELECT` en une expression
`OR` unique, découpage des policies admin `FOR ALL` des tables du menu en
INSERT/UPDATE/DELETE — la lecture publique du menu, chemin le plus chaud, ne
traverse plus qu'une policy `USING (true)` — et restriction à `authenticated` des
policies qui ciblaient `public`. Plus 7 index de couverture de FK et 2 index
composites adossés à la pagination existante.

**Résultat** (advisors Supabase) :

| Advisor                        | Avant | Après |
| ------------------------------ | ----- | ----- |
| `auth_rls_initplan`            | 44    | **0** |
| `multiple_permissive_policies` | 49    | **0** |
| `unindexed_foreign_keys`       | 7     | **0** |

Le dernier cas `multiple_permissive_policies` (`orders` UPDATE :
`orders_admin_update` + `orders_owner_cancel`) est levé par
`20260807000000_consolidate_orders_update_policy.sql`, qui fusionne les deux
policies en une seule (`orders_update`) dont le `USING` et le `WITH CHECK` sont
le `OR` exact des expressions d'origine — Postgres combinant déjà les policies
permissives par `OR`, la sémantique d'autorisation est strictement inchangée
(l'admin met à jour, le client annule sa commande `pending`). Les appels
`auth.uid()`/`has_role()` y restent wrappés en `(select …)` pour ne pas
réintroduire de warning `auth_rls_initplan`.

**Preuve de non-régression.** Le risque d'une réécriture de 54 policies en
production est d'élargir ou de restreindre un accès par inadvertance. J'ai donc
capturé une **matrice d'accès avant/après** — nombre de lignes réellement
visibles pour 20 tables × 4 profils (admin, livreur, client, anon), sous RLS
réelle. Les deux matrices sont **identiques ligne pour ligne**. Complétée par des
tests négatifs, tous refusés après correctif :

| Tentative                                                | Résultat |
| -------------------------------------------------------- | -------- |
| Client note une commande qui n'est pas la sienne (IDOR)   | refusé   |
| Client note avec un `user_id` usurpé                      | refusé   |
| Client note le livreur d'une commande étrangère           | refusé   |
| Client écrit dans le chat d'une commande étrangère        | refusé   |
| Client ajoute une ligne à une commande étrangère          | refusé   |
| Client crée une adresse au nom d'un autre                 | refusé   |
| Client s'attribue le rôle `admin`                         | refusé   |
| Client passe sa commande à `delivered` / modifie `total`   | refusé   |
| Client annule sa commande `pending`                       | **autorisé** (attendu) |
| Livreur modifie le statut ou le total en direct            | refusé (RPC obligatoire) |
| Livreur s'auto-assigne une commande libre                  | refusé   |
| Livreur lit `app_settings` / un profil étranger            | refusé   |
| Anon lit le menu                                           | **autorisé** (attendu) |
| Anon lit `orders` / écrit le menu                          | refusé   |
| Admin gère le menu, les statuts, les livreurs              | **autorisé** (attendu) |

### C‑2 🟠 `as any` masquant de vrais bugs de typage

**Constat.** 22 casts `as any`, dont 9 `(supabase as any)` sur les chemins les
plus sensibles (création de commande, filtres admin, export comptable). Les
commentaires les justifiaient par des types générés « stale ». **Vérification
faite : `types.ts` était en réalité à jour** — j'ai régénéré les types depuis le
schéma live et comparé. Les casts ne compensaient plus rien ; ils désactivaient
silencieusement le typage.

**Ce que leur retrait a révélé** — 7 erreurs de typage *réelles*, corrigées à la
source :

- `Address.is_default` était typé `boolean | undefined` alors que la colonne est
  nullable : le `null` renvoyé par PostgREST violait le type local.
- `admin_dashboard_stats` était appelée avec `null` alors que ses deux paramètres
  sont `DEFAULT NULL` côté SQL (omettre l'argument est l'équivalent correct).
- Un retour de RPC typé `Json` était casté directement vers une interface.

**Résultat** : 22 `any` → **0**, `tsc --noEmit` vert. Les casts sur les cellules
Excel sont remplacés par des types (`StyledCell`, `ExtendedWorkSheet`) modélisant
les extensions que `xlsx-js-style` ajoute sans les déclarer.

**Trou de typage résiduel, assumé et documenté** : `create_order_secure` reçoit
`NULL` pour deux `text` nullables que PostgREST génère en `string`. Le trou est
réduit à ces deux valeurs (helper `nullableText`) au lieu de porter sur tout le
client. Correctif de fond : réordonner les paramètres SQL pour que les nullables
portent `DEFAULT NULL` — non fait ici, car cela impose un `DROP`/`CREATE` de la
fonction sur le chemin critique de création de commande.

### C‑3 🟠 Bundle de la route admin

**Constat.** Le chunk `/dashboard` pesait **1 330 Ko**, dont ~1 Mo de
`xlsx-js-style` — utilisé uniquement par `exportExcel`, au clic — et ~515 Ko de
`recharts`, pour deux graphiques sous la ligne de flottaison.

**Correctif.** `xlsx` passe en `import()` dynamique (type importé séparément via
`import type`, effacé à la compilation, donc les annotations restent vérifiées) ;
les graphiques sont extraits dans `components/dashboard/RatingCharts.tsx` et
chargés via `React.lazy`, derrière un squelette qui réserve exactement leur
hauteur pour éviter tout décalage de mise en page. **Aucune ligne de logique
d'export modifiée** — j'ai d'abord vérifié qu'aucun des 6 helpers n'est appelé
pendant le rendu.

| Mesure                    | Avant    | Après      |
| ------------------------- | -------- | ---------- |
| Chunk `dashboard`         | 1 330 Ko | **116 Ko** (−91 %) |
| `xlsx`                    | inclus   | chunk séparé, au clic |
| `recharts`                | inclus   | chunk séparé, après rendu |

### C‑4 🟠 Requête d'historique admin non bornée

**Constat.** L'onglet « Historique » exécutait `from("orders").select("*")`
**sans limite**, et cet effet se relance à **chaque** événement Realtime sur
`orders`. Le commentaire du code affirmait que la requête « reste performante si
la table grossit » parce que le filtrage est fait côté serveur — mais filtrer
sans borner ne borne rien : avec le filtre par défaut (`status <> 'pending'`), le
résultat est quasiment toute la table.

À l'échelle : transfert répété de `orders` en entier, puis dépassement du
`statement_timeout` de 8 s — l'historique cesserait de s'afficher.

**Correctif.** Requête bornée à `HISTORY_LIMIT` (200) en demandant délibérément
`HISTORY_LIMIT + 1` lignes : si la ligne excédentaire revient, un bandeau
`role="status"` signale que des commandes plus anciennes existent. **Aucune
troncature silencieuse** — l'admin sait toujours qu'il ne voit pas tout.

### C‑5 🟠 Buckets Storage sans aucune contrainte serveur

**Constat.** `avatars` et `menu-images` avaient `file_size_limit = NULL` **et**
`allowed_mime_types = NULL`. Les seules limites (5 Mo / 2 Mo, jpeg+png+webp)
vivaient dans le composant React, qu'un appel direct à l'API Storage ignore.
Combiné à la policy `Avatar upload own`, qui autorise tout utilisateur
authentifié à écrire dans `avatars/<uid>/`, cela exposait :

1. **un abus de stockage** : fichiers de taille arbitraire dans un bucket public,
   facturé au volume et à l'egress ;
2. **un vecteur de XSS stocké** : sans liste MIME, un SVG ou un HTML pouvait être
   servi depuis le domaine Supabase du projet — la CSP de l'application protège
   son origine, pas celle du stockage.

**Correctif** : contraintes serveur alignées **exactement** sur les valeurs déjà
vérifiées côté UI. Aucune régression ; les objets déjà stockés ne sont pas
affectés. Les 4 buckets sont désormais bornés en taille et en type.

### C‑6 🔴 Ni CI ni tests

**Constat.** **Aucun `.github/`, aucun test.** Rien ne garantissait qu'un commit
poussé — y compris ceux synchronisés depuis l'éditeur Lovable — compilait encore.

**Correctif.** CI en 4 jobs (`typecheck` ; `test` ; `build` ; `lint`
non bloquant, `continue-on-error`, le temps de résorber la dette Prettier
préexistante) dans `.github/workflows/ci.yml`, et **16 tests Vitest** sur la
logique métier et les gardes de sécurité (`src/lib/geo.ts`,
`src/lib/order-timing.ts`).

Le test le plus utile est celui de la **parité client/serveur de la zone de
livraison** : les distances de référence ont été **calculées par Postgres** avec
la formule du déclencheur, puis figées dans le test. Toute divergence de formule
ou de constante entre `src/lib/geo.ts` et `enforce_delivery_zone()` casse
désormais la suite — et le comportement *fail-closed* est verrouillé.

**Dépendances mortes retirées** : `xlsx@0.18.5`, déclarée en dépendance directe
mais **jamais importée** (seul le fork autonome `xlsx-js-style` l'est), portait à
elle seule les advisories Prototype Pollution + ReDoS sans correctif amont. Plus
`@hookform/resolvers`, sans aucun import.

`npm audit --omit=dev --audit-level=high` : **6 vulnérabilités high → 0**.

---

## 3. Constats non corrigés

Chacun est laissé ouvert pour une raison explicite.

### 🟠 H‑1 · Le panier affiche une remise que le serveur peut refuser

`create_order_secure` ne concède `WELCOME10` qu'à la **première commande
réelle** (condition `v_has_prior`), alors que `promoDiscountAmount` l'applique
sans condition. Or le code promo est **persisté en `localStorage`** : un client
fidèle qui l'a encore enregistré voit « −10 % » dans son panier et sa commande
est créée au prix plein.

Le serveur fait foi : **aucune perte de revenu**. Mais l'affichage peut mentir au
client, ce qui est un problème de confiance.

**Non corrigé car c'est un arbitrage produit** : masquer la remise pour les
clients ayant déjà commandé (requête supplémentaire au panier) ou libeller
explicitement « réservé à la 1re commande ». Le comportement actuel est verrouillé
par un test afin qu'une correction future soit un changement visible en revue.

### 🟠 H‑2 · ~855 erreurs de formatage et lint non bloquant

ESLint est configuré avec `eslint-plugin-prettier` en `error`, mais le dépôt n'a
jamais été formaté. Le job `lint` est donc **volontairement non bloquant**.

**Non corrigé car** un `npm run format` toucherait presque tous les fichiers :
diff de reformatage massif, impossible à relire en même temps que cet audit, et
source de conflits avec les éditions Lovable en cours. À faire dans un commit
**isolé** ne contenant que du reformatage, puis retirer le `continue-on-error`.

### 🟠 H‑3 · Le livreur ne peut pas lire les options des articles

`DriverOrders.tsx` interroge `order_item_options`, mais la matrice d'accès montre
que le livreur y voit **0 ligne** (policy limitée à l'admin et au propriétaire).
Le livreur ne voit donc jamais les suppléments ni les retraits (« sans oignons »).

**Bug fonctionnel préexistant**, antérieur à mes changements et **inchangé** par
eux. **Non corrigé car** le corriger consiste à **élargir un accès** : c'est une
décision de sécurité à valider, pas un ajustement. Correctif proposé — ajouter au
`OR` de `order_item_options_select` la condition « livreur assigné à la commande
parente », sur le modèle de `addresses_select`.

### 🟡 M‑1 · Gouvernance du schéma : dérive Git ↔ base

L'audit antérieur relevait que plusieurs tables, policies et fonctions avaient
été créées via l'éditeur Lovable Cloud **sans migration**. La divergence a depuis
été largement résorbée, mais le **processus** qui l'a produite subsiste. Tant que
des changements de schéma peuvent être appliqués hors migration, l'état de
sécurité réel n'est pas vérifiable depuis Git.

Recommandation : interdire les modifications de schéma hors migration, et ajouter
un job CI comparant les policies live à celles attendues.

### 🟡 M‑2 · Aucun test automatisé des policies RLS

La vérification de cet audit (matrice + tests négatifs) a été menée **à la
main**. C'est précisément ce qui devrait être rejouable à chaque commit.

C'est le **meilleur retour sur investissement** de test restant : ~150 lignes
scriptant `set local role` + `request.jwt.claims` et comparant à une matrice
attendue. Non fait ici car cela requiert un accès base en CI (branche Supabase
dédiée ou Postgres éphémère) — une décision d'infrastructure.

### 🟡 M‑3 · Actifs images non optimisés

- `images/` contient **9 Mo de PNG entièrement non référencés** (dont des
  doublons `_old`). **Volontairement non supprimés** : ce sont probablement des
  originaux de photos de plats, potentiellement irremplaçables. À archiver hors
  du dépôt après confirmation.
- `src/assets/box-logo-transparent.png` pèse **577 Ko** pour un rendu à 88 px, et
  `BoxLogo` est présent sur presque tous les écrans. Une version WebP
  correctement dimensionnée ferait ~15–25 Ko. Non fait : aucun outil d'encodage
  d'image n'est disponible dans cet environnement, et je préfère ne pas ajouter
  une dépendance de build pour cela.

### 🟡 M‑4 · Composants volumineux

`dashboard.tsx` (~1 270 lignes après extraction), `admin/menu.tsx` (1 160),
`MenuPage.tsx` (1 127), `VitrineSite.tsx` (1 099). La logique d'export Excel
représente à elle seule ~700 lignes de `dashboard.tsx` et mériterait de vivre
dans `src/lib/excel-export.ts`.

**Non fait car** déplacer 700 lignes de mise en forme Excel intriquée, sans
pouvoir vérifier le classeur produit, est un risque de régression réel pour un
gain purement structurel. Le gain de performance, lui, a été obtenu sans ce
déplacement (C‑3).

### 🔵 B‑1 · Points mineurs

- **Protection « mots de passe compromis » désactivée** dans Supabase Auth
  (HaveIBeenPwned). Activation en un clic dans le dashboard — non modifiable par
  migration.
- `expire_stale_orders` est exécutable par tout utilisateur authentifié. Impact
  quasi nul (elle ne fait expirer que des commandes déjà échues), mais il n'y a
  aucune raison de l'exposer : `REVOKE EXECUTE … FROM authenticated`.
- Advisor `rls_enabled_no_policy` sur `internal_config` : **faux positif**. RLS
  active sans policy est ici le comportement voulu (deny-by-default,
  `service_role` exclusivement).
- 5 index signalés « non utilisés » : les nouveaux index de FK n'ont simplement
  pas encore servi. Ils existent pour éviter les scans séquentiels à l'échelle.

---

## 4. Ce qui était déjà bon

À signaler, car cela reflète un travail antérieur sérieux :

- **RLS active sur les 20 tables** de `public`, sans exception.
- **`user_roles` sans aucune policy d'écriture** : l'escalade de rôle par l'API
  est structurellement impossible.
- **`create_order_secure`** : le client n'envoie aucun prix ; totaux et remises
  sont recalculés en base (correctif F‑02 confirmé).
- **Aucun droit d'UPDATE direct pour le livreur** sur `orders` : les transitions
  passent obligatoirement par une RPC qui les valide (F‑04 confirmé).
- **Toutes les fonctions `SECURITY DEFINER` ont un `search_path` figé**, et les
  fonctions internes ne sont pas exposées à `anon` (F‑01 confirmé).
- **CSP à nonce par requête**, sans `script-src 'unsafe-inline'`, source de
  vérité unique dans `src/server.ts`. Plus HSTS `preload`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
- **`livreur_stats` est une vue `security_invoker=on`** : elle n'expose pas les
  données inter-livreurs (piège classique des vues, correctement évité).
- **Zone de livraison *fail-closed*** et dupliquée client + base à dessein.
- **Aucune fuite de `service_role`** dans le bundle client (vérifié).
- **Pagination keyset** déjà en place dans `commandes.tsx`.

---

## 5. Priorités recommandées

| # | Action                                                        | Effort | Gain |
| - | ------------------------------------------------------------- | ------ | ---- |
| 1 | Trancher H‑1 (affichage de la remise) — visible par le client  | S      | Confiance |
| 2 | Décider H‑3 (options pour le livreur) — bug fonctionnel        | S      | Exploitation |
| 3 | `npm run format` isolé, puis lint bloquant (H‑2)                | S      | Qualité |
| 4 | Tests RLS automatisés en CI (M‑2)                              | M      | Sécurité durable |
| 5 | Interdire les changements de schéma hors migration (M‑1)        | S      | Gouvernance |
| 6 | Logo en WebP dimensionné (M‑3)                                 | S      | Perf mobile |
| 7 | Sentry + Vercel/Cloudflare Analytics (aucun monitoring actuel)  | M      | Exploitation |
| 8 | Extraire `excel-export.ts` (M‑4)                               | M      | Maintenabilité |

**Monitoring** : il n'y a aujourd'hui **aucune remontée d'erreurs applicative**.
`src/lib/error-capture.ts` et `lovable-error-reporting.ts` couvrent le SSR, mais
rien n'agrège les erreurs client en production. C'est l'angle mort d'exploitation
le plus large qui subsiste — d'où le point 7.

---

## 6. Tenue de charge

La base contient aujourd'hui **~143 commandes**. Les correctifs C‑1 et C‑4
changent la forme des courbes de coût, pas seulement leur pente.

| Volume de commandes | Avant l'audit                                        | Après |
| ------------------- | ---------------------------------------------------- | ----- |
| ~10³                | Fonctionne ; historique admin déjà lourd              | Confortable |
| ~10⁴                | RLS réévaluée ~10⁴×/requête ; historique admin proche du timeout 8 s | Confortable |
| ~10⁵                | Historique client et admin **en échec** (timeout)     | Tenable ; surveiller le tableau de bord |
| ~10⁶                | Hors d'atteinte                                       | Prévoir le partitionnement de `orders` par date et le passage des agrégats en vues matérialisées |

Ces seuils concernent **un seul restaurant**. La montée à plusieurs
établissements est un sujet distinct — §7.

---

## 7. Multi-restaurants : ce que cela coûterait réellement

Si l'objectif du brief (« milliers de restaurants ») est bien la cible, voici la
nature du travail. Ce n'est **pas** une optimisation de l'existant.

1. **Schéma** — table `restaurants` ; colonne `restaurant_id` sur `orders`,
   `order_items`, `menu_items`, `categories`, `livreurs`, `addresses`,
   `app_settings`, `option_groups`… ; rétro-remplissage des lignes existantes.
2. **Autorisations** — réécriture des ~30 policies pour croiser l'appartenance au
   locataire *en plus* de la propriété utilisateur, et une notion
   d'« administrateur de restaurant » distincte du Super Admin. C'est le poste le
   plus risqué : chaque policy manquée est une fuite inter-locataires.
3. **Constantes devenues des données** — coordonnées et rayon de livraison sont
   codés en dur dans `src/lib/geo.ts` **et** dans `enforce_delivery_zone()` ; ils
   doivent devenir des colonnes de `restaurants`, en conservant la parité
   client/serveur (déjà couverte par les tests).
4. **Index** — tous les index composites doivent être préfixés par
   `restaurant_id`, sinon chaque requête scanne toutes les commandes de tous les
   établissements.
5. **Tests** — la matrice d'accès doit gagner une dimension : le test décisif
   devient « un admin du restaurant A ne voit rien du restaurant B ».

Estimation : plusieurs semaines, avec une migration de données à risque. À
décider explicitement, produit en main — pas à engager au fil de l'eau.
