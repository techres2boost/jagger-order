## Objectif

App web React (packagée ensuite en mobile via Capacitor) pour le restaurant BOX : menu, panier, commande, admin, auth unique. Zéro paiement en ligne. Backend Supabase (Lovable Cloud).

## Étape 1 — Backend (Lovable Cloud)

- Activer Lovable Cloud.
- Migration SQL :
  - `profiles(id, full_name, phone, role)` + trigger `on_auth_user_created`.
  - Enum `app_role ('client','admin')`, table `user_roles`, fonction `has_role()`.
  - `orders(id, user_id, customer_name, phone, total, status, expires_at, created_at)` + `order_items(id, order_id, name, size, qty, unit_price, note)`.
  - RLS : client lit/écrit ses propres commandes ; admin lit tout et update statut (via `has_role`).
  - GRANTs appropriés.
  - Fonction/trigger côté SQL qui passe `pending → expired` quand `now() > expires_at`.
- Realtime activé sur `orders`.

## Étape 2 — Design system

- `src/styles.css` : rouge accent BOX (#E30613 approx), blanc dominant, noir support, tokens sémantiques oklch, typo bold titres.
- Composants shadcn stylés via variants (bouton "hero" rouge, badge "populaire").

## Étape 3 — Données menu (statique, `src/data/menu.ts`)

- Burgers (18 items, pas de photos).
- Boissons intégrées d'après ta réponse : Boga Lime, Boga Cidre, Coca Zéro, Hawaï, Fanta Orange, Fanta Citron, Coca-Cola 3.000 ; Eau 1.5L 2.000 ; Eau 0.5L 1.500 ; Eau Garci 1.000. Le reste marqué `// À COMPLÉTER`.
- Pizzas 13 items (4 formats de prix). Pas de photo pour Box → placeholder. Pepperoni/Turk ignorés.
- Sandwichs 13 items, `escalope.png` réutilisée pour grillée et panée. cordonBleu/kabeb/mexican ignorés.
- Entrées (13 items, sans photos).
- Suppléments pizza.
- Photos via URL raw `https://raw.githubusercontent.com/khadijabenjaafar/la-roja/main.c/box/...`.
- `populaire: true` : Sandwich Steak Haché, Pizza Mexicaine, Sandwich (Cordon Bleu → placeholder car ignoré, remplacé par un populaire cohérent OU marqué `// À COMPLÉTER`), Big Cheese (proxy pour "Big Chicken Burger" inexistant → `// À COMPLÉTER`). Je marquerai clairement les 2 non trouvés au menu et mettrai en avant les 2 confirmés + 2 alternatives explicitement notées.

## Étape 4 — Routing (TanStack Start)

- `/` Menu (public, consultation libre).
- `/auth` Login/Signup toggle + reset password.
- `/verify-email` écran de vérification + bouton renvoyer (cooldown 60s).
- `/reset-password` set new password.
- `/_authenticated/panier`, `/_authenticated/commande/$id` (email confirmé requis, sinon redirect verify).
- `/_authenticated/_admin/admin` (role=admin via `has_role`).
- Splash 1.8s au premier chargement.

## Étape 5 — Composants UI

- Splash rouge → fade.
- Bandeau promo "Livraison à domicile disponible".
- Tabs catégories sticky en pilules.
- Grille 2 col cards avec photo carrée arrondie + "+".
- Détail plat : photo grand format arrondie bas, ingrédients, sélecteur taille (pizza/sandwich), suppléments, quantité, bouton "Ajouter" fixe bas.
- Bouton panier flottant avec badge.
- Panier : liste, quantité, note, nom/tel pré-remplis, "Confirmer".
- Écran confirmation avec Realtime : pending → accepted/refused/expired.
- Admin : liste live avec minuteur 2:00, accepter/refuser, historique.

## Étape 6 — Auth

- Supabase email/password.
- Signup : full_name, phone, email, password → trigger crée profile role='client'.
- Vérif email obligatoire pour panier/commande (menu reste libre).
- Bouton logout partout.
- Redirection post-login : admin → /admin, client → /.

## Étape 7 — Logique commandes

- Créer commande + items en une transaction (server function), `expires_at = now + 2 min`.
- Client écoute `orders` via Realtime (filtre `id=eq.X`).
- Admin écoute `orders` filtre `status=eq.pending`, tri par `created_at`.
- Update statut verrouillé (RLS + check `status='pending'`).
- Expiration serveur : fonction déclenchée à chaque SELECT admin, ou cron pg_cron toutes les minutes qui update les pending expirés.

## Étape 8 — SEO & meta

- Title/description BOX dans `__root.tsx`.
- Sitemap + robots.

## Étape 9 — Fichiers hors scope

- SMTP custom Supabase, notifications push mobile, packaging Capacitor : hors du build (nécessite config manuelle). Je documenterai dans un README.

## Points signalés `// À COMPLÉTER` dans le code

- Boissons Jus/Milkshake/Shark/Thé/Café/Frites/Dessert.
- Photo Pizza Box.
- Populaires "Cordon Bleu" et "Big Chicken Burger" (absents du menu fourni).
- Format Coca-Cola (33/50/1.5L non précisé).

Je commence par l'activation Cloud + migration, puis design system + menu + auth + pages.
