# BOX — Cas de test exhaustifs (chasse aux bugs)

> **Stack analysée** : React 19 + Vite 8, TanStack Router/Start (SSR partiel, `ssr:false` sur les routes authentifiées), Supabase (Auth OTP SMS + Google OAuth, Postgres + RLS, Realtime, Storage, Edge Functions, pg_cron), shadcn/ui + Tailwind v4, Leaflet + Nominatim (OpenStreetMap), Web Push (VAPID), PWA (service worker `/sw.js`).
>
> **Rôles** : `client`, `admin`, `livreur` (table `user_roles` + `has_role()`).
> **Statuts commande** : `pending → accepted → ready → delivering → delivered`, plus terminaux `refused` / `expired` / `cancelled`.
> **Zone de livraison** : rayon 7 km (Haversine) autour de `36.84130243040511, 10.156443054054316`. Validé **client** (`src/lib/geo.ts`) **et serveur** (trigger `enforce_delivery_zone` sur INSERT `orders`).
> **Panier** : 100 % localStorage (`box_cart`, `box_promo`), aucun serveur avant « Confirmer ».
>
> **Légende sévérité** : 🔴 Bloquant · 🟠 Majeur · 🟡 Mineur.
> Chaque cas indique la sévérité **attendue si le comportement est bugué**.

## Table des matières
1. [Auth & Session (BOX-AUTH)](#1-auth--session-box-auth)
2. [Menu & Catalogue (BOX-MENU)](#2-menu--catalogue-box-menu)
3. [Panier (BOX-CART)](#3-panier-box-cart)
4. [Commande & Checkout (BOX-ORD)](#4-commande--checkout-box-ord)
5. [Suivi commande & Countdown (BOX-TRACK)](#5-suivi-commande--countdown-box-track)
6. [Admin (BOX-ADMIN)](#6-admin-box-admin)
7. [Livreur & Assignation (BOX-DRV)](#7-livreur--assignation-box-drv)
8. [Adresses & Carte (BOX-ADDR)](#8-adresses--carte-box-addr)
9. [Géolocalisation & Zone (BOX-GEO)](#9-géolocalisation--zone-box-geo)
10. [Notifications Push (BOX-PUSH)](#10-notifications-push-box-push)
11. [Realtime & Chat (BOX-RT)](#11-realtime--chat-box-rt)
12. [Codes promo (BOX-PROMO)](#12-codes-promo-box-promo)
13. [Profil & Compte (BOX-PROF)](#13-profil--compte-box-prof)
14. [Sécurité & RLS (BOX-SEC)](#14-sécurité--rls-box-sec)
15. [PWA / Offline / Service Worker (BOX-PWA)](#15-pwa--offline--service-worker-box-pwa)
16. [UI Responsive & Accessibilité (BOX-UI)](#16-ui-responsive--accessibilité-box-ui)
17. [Données invalides & i18n (BOX-DATA)](#17-données-invalides--i18n-box-data)

---

## 1. Auth & Session (BOX-AUTH)

### Nominal
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-AUTH-001 | Connexion OTP SMS nominale | Numéro TN valide, non connecté | `/auth` → saisir `12345678` → « Envoyer le code » → saisir OTP reçu → « Confirmer » | Toast « Code envoyé », puis redirection selon rôle (`/admin`, `/livreur`, sinon `redirect`/`/app`) | 🔴 |
| BOX-AUTH-002 | Connexion Google OAuth | Compte Google | `/auth` → « Continuer avec Google » → consentement | Retour sur `redirect ?? /app`, profil upserté (`full_name`/`phone` depuis metadata) | 🟠 |
| BOX-AUTH-003 | Post-login rôle admin | Compte avec rôle admin | Login OTP | Redirection `/admin` (pas `/app`) | 🟠 |
| BOX-AUTH-004 | Post-login rôle livreur | Compte lié à une fiche `livreurs` | Login | Redirection `/livreur` → `/driver/orders` | 🟠 |
| BOX-AUTH-005 | « Continuer sans compte » | Non connecté | `/auth` → lien du bas | Accès `/app` (menu public) sans session | 🟡 |

### Limites / format téléphone
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-AUTH-010 | Téléphone vide | — | « Envoyer le code » champ vide | Champ `required` bloque ; sinon toast « Numéro invalide » | 🟡 |
| BOX-AUTH-011 | Téléphone trop court (`+2161`) | — | Saisir `1` | `normalizePhone` rejette (`{6,14}`) → toast erreur, pas d'appel Supabase | 🟠 |
| BOX-AUTH-012 | Téléphone avec espaces/tirets | — | Saisir `12 345-678` | `replace(/\s|-/g)` nettoie → `+21612345678` accepté | 🟡 |
| BOX-AUTH-013 | Téléphone avec `+` déjà tapé | — | Saisir `+21612345678` | Concaténation `+216`+saisie donne `+216+216...` → **doit** échouer proprement (regex `^\+[1-9]`) — vérifier UX | 🟡 |
| BOX-AUTH-014 | Numéro non-TN (déjà `+33...`) | — | Saisir `33612345678` | Devient `+21633612345678` — numéro erroné envoyé au SMS ; vérifier qu'aucun SMS partant vers mauvais pays | 🟠 |
| BOX-AUTH-015 | OTP non-numérique filtré | Code envoyé | Taper lettres dans le champ OTP | `replace(/\D/g)` → seuls chiffres, `maxLength=6` | 🟡 |

### Erreurs / expiration OTP
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-AUTH-020 | OTP invalide | Code envoyé | Saisir mauvais code → Confirmer | Toast « Code invalide ou expiré », reste sur l'écran OTP | 🟠 |
| BOX-AUTH-021 | OTP expiré | Attendre > TTL Supabase | Saisir l'ancien code | Toast d'erreur, possibilité de renvoyer via « Changer de numéro » | 🟠 |
| BOX-AUTH-022 | Renvoi SMS / rate limit | Cliquer « Envoyer » plusieurs fois | Spam du bouton | Supabase renvoie erreur rate-limit → toast lisible (pas de crash) ; **aucun cooldown UI côté OTP SMS** → vérifier abus | 🟠 |
| BOX-AUTH-023 | Double-clic « Envoyer le code » | — | Double-clic rapide | `loading` désactive le bouton pendant l'envoi → un seul appel | 🟡 |
| BOX-AUTH-024 | Erreur réseau à l'envoi OTP | Couper le réseau | « Envoyer » | Promesse rejette → toast « Envoi du code échoué », `loading` remis à false | 🟠 |
| BOX-AUTH-025 | Erreur réseau à la vérification | Couper le réseau après envoi | « Confirmer » | Toast d'erreur, bouton réactivé | 🟠 |

### Garde de routes / session
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-AUTH-030 | Accès `/panier` non connecté | Déconnecté | Aller `/panier` | `_authenticated.beforeLoad` → redirect `/auth` | 🔴 |
| BOX-AUTH-031 | Accès authentifié sans email/phone confirmé | Compte email non vérifié, pas de `phone_confirmed_at`/`confirmed_at` | Aller `/panier` | Redirect `/verify-email` | 🟠 |
| BOX-AUTH-032 | OTP SMS = `phone_confirmed_at` présent | Login OTP réussi | Aller `/panier` | Passe la garde (confirmé via téléphone) sans email | 🟠 |
| BOX-AUTH-033 | Token expiré pendant navigation | Session expirée (JWT) | Naviguer vers route authentifiée | `getUser()` renvoie erreur/null → redirect `/auth` (pas d'écran blanc) | 🟠 |
| BOX-AUTH-034 | Token expiré **pendant** une action (confirm commande) | Session expire juste avant clic « Confirmer » | Cliquer Confirmer | `userRes.user!.id` avec `user=null` → **crash potentiel** (`!` non-null assertion) ; doit gérer proprement | 🔴 |
| BOX-AUTH-035 | Déconnexion en plein flux | Panier rempli, connecté | Logout depuis un autre onglet, revenir | La page reste montée ; prochaine écriture Supabase échoue en RLS → toast, pas de state incohérent | 🟠 |
| BOX-AUTH-036 | `onAuthStateChange` deadlock rôles | Login | Observer console | Le `setTimeout(...,0)` évite le deadlock (rôles chargés en différé) ; `rolesResolved` passe false→true | 🟡 |
| BOX-AUTH-037 | Rôles non résolus → flash UI | Login lent | Observer `/app` | Tant que `rolesResolved=false`, `isAdmin/isLivreur=false` ; livreur ne doit pas voir l'UI client (écran « Redirection ») | 🟡 |
| BOX-AUTH-038 | Deux onglets, logout dans l'un | 2 onglets connectés | Logout onglet A | `onAuthStateChange` propage la session nulle à l'onglet B | 🟡 |
| BOX-AUTH-039 | Reset password sans session de recovery | Ouvrir `/reset-password` directement | Saisir mot de passe | `updateUser({password})` échoue sans session recovery → toast erreur (pas de succès trompeur) | 🟠 |
| BOX-AUTH-040 | Reset password < 6 caractères | Sur `/reset-password` | Saisir `123` | `minLength=6` HTML bloque | 🟡 |
| BOX-AUTH-041 | verify-email : passage auto au confirmé | Sur `/verify-email`, cliquer le lien email dans un autre onglet | Revenir | `onAuthStateChange` détecte `email_confirmed_at` → navigate `/app` | 🟠 |
| BOX-AUTH-042 | verify-email : cooldown renvoi | Sur `/verify-email` | Cliquer « Renvoyer » | Cooldown 60 s, bouton désactivé + décompte | 🟡 |
| BOX-AUTH-043 | verify-email sans email (compte OTP) | Login OTP, forcer `/verify-email` | — | `email=null` → `resend` no-op ; texte « envoyé à » vide géré | 🟡 |

---

## 2. Menu & Catalogue (BOX-MENU)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-MENU-001 | Chargement menu public | Non connecté | `/app` | Catégories + plats chargés depuis Supabase (`categories`, `menu_items`, sizes, options) | 🔴 |
| BOX-MENU-002 | Erreur de chargement (une des 6 requêtes échoue) | Supabase down | `/app` | Toast d'erreur agrégé, `loading=false` (pas de spinner infini) | 🟠 |
| BOX-MENU-003 | Filtre catégorie « Tout » | Menu chargé | Cliquer « Tout » | Tous les plats `is_available=true` | 🟡 |
| BOX-MENU-004 | Recherche par nom/description | — | Taper une requête | Filtre insensible casse ; bouton « X » efface | 🟡 |
| BOX-MENU-005 | Tri prix croissant/décroissant | — | Ouvrir filtre → asc/desc | Tri par `price` ou `min(sizes)` ; `Infinity` pour plats sans prix (fin de liste en asc) | 🟡 |
| BOX-MENU-006 | Plat multi-formats (pizza) | Pizza 4 formats | Ouvrir détail | Prix « dès X » ; sélecteur Format ; total recalculé au changement | 🟠 |
| BOX-MENU-007 | Suppléments : limite `maxSelection` | Plat avec groupe supplément | Cocher > max | Bloqué à `maxSelection`, message « Limite atteinte » ; case grisée `disabled` | 🟠 |
| BOX-MENU-008 | Options « retirable » = prix 0 | Plat avec options retirables | Cocher | Ajoutées au panier avec `price:0`, pas dans le total | 🟡 |
| BOX-MENU-009 | Plat `incomplete` | Item marqué à compléter | Ouvrir | Bouton « Ajouter » `disabled`, badge « À compléter », bouton `+` masqué | 🟡 |
| BOX-MENU-010 | Ajout depuis carte populaire | Populaire présent | Cliquer `+` sur PopularCard | **Ouvre le détail** (n'ajoute pas directement) — vérifier attendu vs libellé « Ajouter au panier » | 🟡 |
| BOX-MENU-011 | Badge quantité en panier | Article déjà au panier | Revenir au menu | Badge `x{qty}` sur la carte, ring rouge | 🟡 |
| BOX-MENU-012 | Quantité min = 1 dans le détail | Détail ouvert | Cliquer `−` plusieurs fois | Bloqué à 1 (`Math.max(1, q-1)`) | 🟡 |
| BOX-MENU-013 | Nom pizza préfixé | Catégorie « Pizzas » | Afficher | `displayName` ajoute « Pizza » (attention : comparaison `category?.toLowerCase()` sur `category_id`, pas le **nom** → préfixe probablement jamais appliqué) | 🟡 |
| BOX-MENU-014 | Carrousel promo swipe | — | Swipe bannières | Index synchronisé avec les points ; clic point = scroll | 🟡 |
| BOX-MENU-015 | Image plat cassée | `image_url` invalide | Afficher | Fallback couleur/logo (pas d'icône brisée dans le détail ; `onError` seulement sur AddAddress) | 🟡 |
| BOX-MENU-016 | Livreur atterrit sur `/app` | Rôle livreur | Aller `/app` | Redirect `/livreur` ; écran « Redirection… » entre-temps | 🟡 |
| BOX-MENU-017 | Modal détail + clavier virtuel (mobile) | Mobile, groupe avec input | Ouvrir détail, focus input | Footer « Ajouter » reste visible (calc `visualViewport`) | 🟠 |
| BOX-MENU-018 | Menu vide (aucun plat dispo) | Tous `is_available=false` | `/app` | « Aucun plat dans cette catégorie », pas de crash | 🟡 |

---

## 3. Panier (BOX-CART)

### Nominal & limites
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-CART-001 | Panier vide | Aucun article | `/panier` | « Votre panier est vide », bouton « Voir le menu » | 🟡 |
| BOX-CART-002 | Ajout puis fusion de lignes identiques | Même item+size+options | Ajouter 2×  | Une seule ligne, `qty` additionnée (clé = `itemId|size|optionsTriées`) | 🟠 |
| BOX-CART-003 | Options dans un ordre différent = même ligne | Mêmes options ordre inversé | Ajouter | Clé identique (`.sort()`) → fusion | 🟡 |
| BOX-CART-004 | Quantité → 0 supprime la ligne | Ligne qty=1 | Cliquer `−` | `setQty(qty<=0)` retire la ligne | 🟡 |
| BOX-CART-005 | Quantité très élevée | — | Monter qty à 9999 | Total calculé correctement (pas d'overflow) ; **pas de plafond** → vérifier UX/serveur | 🟡 |
| BOX-CART-006 | Note par article (onBlur) | Ligne présente | Saisir note, blur | `setNote` persiste ; note vide OK | 🟡 |
| BOX-CART-007 | Instructions spéciales maxLength 500 | — | Coller > 500 car. | Tronqué à 500 (`maxLength`) | 🟡 |
| BOX-CART-008 | Persistance panier au reload | Panier rempli | F5 | Rechargé depuis `localStorage.box_cart` | 🟠 |
| BOX-CART-009 | localStorage indisponible (mode privé/quota) | Navigation privée stricte | Ajouter article | `try/catch` silencieux → app ne crashe pas (panier non persisté) | 🟠 |
| BOX-CART-010 | localStorage corrompu | Injecter JSON invalide dans `box_cart` | Recharger | `loadCartFromStorage` catch → `[]` (pas de crash) | 🟠 |
| BOX-CART-011 | `menu_items` supprimé après ajout | Item retiré du menu | Ouvrir panier | `menuInfo` sans image → emoji 🍽️, pas de crash ; prix stocké dans la ligne conservé | 🟡 |

### Concurrence & double onglet
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-CART-012 | Deux onglets modifient le panier | 2 onglets `/app` | Ajouter dans A, puis dans B | Pas de sync live (localStorage lu au montage) ; dernier `setLines` écrase → **perte possible** d'articles de l'autre onglet | 🟠 |
| BOX-CART-013 | `clear()` vide panier + promo | Panier + WELCOME10 | Confirmer commande | `clear()` vide `box_cart` et retire `box_promo` | 🟡 |

---

## 4. Commande & Checkout (BOX-ORD)

### Nominal
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ORD-001 | Checkout complet | Connecté, profil + adresse en zone, panier plein | `/panier` → Confirmer | Insert `orders` + `order_items` + `order_item_options`, `expires_at = now+2min`, navigate `/commande/$id` | 🔴 |
| BOX-ORD-002 | Profil incomplet → redirect | Pas de `full_name` ou pas d'adresse | Confirmer | Redirect `/complete-profile?redirect=/panier` | 🟠 |
| BOX-ORD-003 | Total = sous-total − remise | WELCOME10 éligible | Confirmer | `orders.total = finalTotal` (arrondi 3 déc.) | 🟠 |
| BOX-ORD-004 | Distance persistée serveur | Adresse en zone | Confirmer | `distance_km` **recalculé par le trigger** (valeur cliente ignorée) | 🟡 |

### Erreurs partielles / atomicité (⚠️ zone à risque)
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ORD-010 | Échec insert `order_items` après `orders` OK | Forcer erreur RLS/réseau sur items | Confirmer | `orders` créé mais items non → **commande orpheline** sans articles (pas de transaction). Vérifier compensation/rollback | 🔴 |
| BOX-ORD-011 | Échec insert `order_item_options` | Options présentes, forcer erreur | Confirmer | `orders`+`order_items` créés, options manquantes → commande partielle. Le panier **n'est pas vidé** (return avant `clear()`) → risque double envoi | 🟠 |
| BOX-ORD-012 | `createdItems` index désaligné | Ligne panier avec 0 option intercalée | Confirmer | Mapping `createdItems[index]` suppose l'ordre d'insert préservé — vérifier alignement item↔options si Postgres réordonne | 🟠 |
| BOX-ORD-013 | Timeout Supabase à l'insert | Latence réseau élevée | Confirmer | `submitting` reste `true` si la promesse ne rejette jamais → bouton bloqué ; vérifier timeout/reset | 🟠 |
| BOX-ORD-014 | Insert rejeté par trigger zone | Adresse hors zone (contourne UI) | Confirmer via appel direct | Trigger `check_violation` → toast `error.message`, pas de commande | 🔴 |

### Concurrence
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ORD-020 | Double-clic « Confirmer » | Panier prêt | Double-clic rapide | `submitting`+`disabled` empêchent le 2ᵉ ; **mais** l'état async se met à jour après le 1ᵉ `await` → fenêtre de course → vérifier une seule commande | 🔴 |
| BOX-ORD-021 | Deux onglets confirment le même panier | Panier identique 2 onglets | Confirmer dans les deux | 2 commandes distinctes créées (panier client) → doublon métier ; vérifier acceptable ou dédup | 🟠 |
| BOX-ORD-022 | Confirmer avec panier vidé entre-temps | Autre onglet vide le panier | Confirmer | `lines.length===0` → `return` silencieux (pas de commande vide) | 🟡 |
| BOX-ORD-023 | `welcomeEligible` course (déps vides) | WELCOME10 | Charger panier | `useEffect` d'éligibilité a `[]` en dépendance mais lit `hasWelcomePromo` → valeur figée au montage ; changement de promo après montage non pris en compte | 🟡 |

---

## 5. Suivi commande & Countdown (BOX-TRACK)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-TRACK-001 | Écran pending + décompte 2:00 | Commande pending | `/commande/$id` | Ring étape 0, compte à rebours `mm:ss` | 🟠 |
| BOX-TRACK-002 | Transition Realtime pending→accepted | Admin accepte | Observer client | Ring avance, texte « en préparation », countdown arrivée affiché | 🔴 |
| BOX-TRACK-003 | Auto-expiration côté client | Pending, `expires_at` dépassé | Laisser tourner | `expire_stale_orders` RPC appelée **une seule fois** (`useRef`), statut → expired | 🟠 |
| BOX-TRACK-004 | Écran refusé + motif | Admin refuse « unavailable » | Observer | « Commande refusée » + « Plat non disponible » | 🟠 |
| BOX-TRACK-005 | Écran expiré | Statut expired | — | « Délai dépassé », bouton « Recommander » | 🟡 |
| BOX-TRACK-006 | Annulation client (pending) | Pending, timer > 0 | « Annuler » → « Oui » | Update `status=cancelled` **guardé** `.eq(status,pending)` ; si déjà accepté entre-temps → 0 ligne, pas d'erreur mais UI incohérente à vérifier | 🟠 |
| BOX-TRACK-007 | Annuler après acceptation (course) | Admin accepte pendant la modale | Confirmer annulation | Guard `.eq(status,pending)` empêche l'annulation ; **toast « annulée » affiché quand même** (pas de vérif du nb de lignes) → faux positif UX | 🟠 |
| BOX-TRACK-008 | « Recommander » | Commande terminée | Cliquer | Items ré-ajoutés au panier avec `itemId=order-{id}-{itemId}` → **ne matche aucun `menu_items`** → pas d'image, prix figé (potentiellement périmé) | 🟠 |
| BOX-TRACK-009 | Bouton « Suivre » en delivering | Statut delivering | — | Lien vers `/orders/$id/tracking` visible uniquement en delivering | 🟡 |
| BOX-TRACK-010 | Countdown après terminal | Statut delivered | — | Tick stoppé (`isTerminal`), pas de setInterval fuyant | 🟡 |
| BOX-TRACK-011 | `arrival_at` absent (commande ancienne) | Pas de `arrival_at` | — | Repli sur `estimated_delivery_at` ; label « X min » ou « Bientôt là » | 🟡 |
| BOX-TRACK-012 | Commande inexistante / non autorisée | ID d'une autre commande | `/commande/$autre` | `.single()` → RLS filtre → `order=null` → « Chargement… » **infini** (pas d'état 404) | 🟠 |
| BOX-TRACK-013 | Event Realtime dupliqué | Reconnexion WS | — | `setOrder(payload.new)` idempotent (remplace) ; pas de doublon d'état | 🟡 |
| BOX-TRACK-014 | WS coupé puis reconnecté | Couper réseau puis rétablir | — | À la reco, pas de re-fetch initial → un event manqué pendant la coupure peut laisser un statut périmé jusqu'au prochain UPDATE | 🟠 |
| BOX-TRACK-015 | Horloge client désynchronisée | Décaler l'horloge de +10 min | Pending | Countdown négatif → expiration prématurée déclenchée côté client (`expire_stale_orders` global) | 🟠 |

---

## 6. Admin (BOX-ADMIN)

### Accès & liste
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ADMIN-001 | Garde admin | Non-admin connecté | Aller `/admin` | `beforeLoad` → redirect `/app` | 🔴 |
| BOX-ADMIN-002 | Liste temps réel pending | Admin | `/admin` | Commandes pending, tri `created_at` desc, timer 2:00 par carte | 🔴 |
| BOX-ADMIN-003 | Realtime + poll 15 s | Admin | Nouvelle commande arrive | `loadAll()` via channel `*` **et** poll → liste à jour | 🟠 |
| BOX-ADMIN-004 | Son d'alerte nouvelle commande | Admin, pending > 0 | Nouvelle commande | Beep en boucle (1.5 s) ; démute auto si count augmente | 🟡 |
| BOX-ADMIN-005 | AudioContext non débloqué | Aucun geste utilisateur | Charger `/admin` | Beep silencieux jusqu'au 1ᵉ `pointerdown`/`keydown` (limite navigateur) — vérifier réactivation | 🟡 |
| BOX-ADMIN-006 | Mute/unmute son | Pending > 0 | Toggle | Bouton bascule ; son coupé quand muté | 🟡 |

### Actions (transitions verrouillées)
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ADMIN-010 | Accepter | Pending | « Accepter » | `status=accepted` guardé `.eq(status,pending)`, `estimated_ready_at/delivery_at` calculés | 🔴 |
| BOX-ADMIN-011 | Refuser + motif | Pending | « Refuser » → motif → confirmer | `status=refused`+`refusal_reason` ; retry sans motif si colonne absente (toast warning) | 🟠 |
| BOX-ADMIN-012 | Marquer prête | Accepted | « Prête » | `status=ready` guardé `.eq(status,accepted)` ; déclenche `admin_process_assignments` (non bloquant) | 🟠 |
| BOX-ADMIN-013 | Marquer livrée (admin) | Delivering | « Livrée » | `status=delivered` guardé `.eq(status,delivering)` | 🟠 |
| BOX-ADMIN-014 | Accepter une commande expirée | Pending mais `expires_at` passé | Cliquer « Accepter » vite | `loadAll` appelle `expire_stale_orders` d'abord ; course possible : accept sur pending encore présent en mémoire mais expiré en base → guard `.eq(pending)` peut réussir avant expiration → vérifier | 🟠 |
| BOX-ADMIN-015 | Deux admins accept/reject simultané | 2 sessions admin | Un accepte, l'autre refuse même commande | 1ᵉ update gagne (`.eq(status,pending)`), 2ᵉ matche 0 ligne mais **toast succès affiché quand même** (pas de vérif count) → faux positif | 🟠 |
| BOX-ADMIN-016 | Double-clic « Accepter » | Pending | Double-clic | 2ᵉ update matche 0 ligne (déjà accepted) mais aucune vérif → toast succès trompeur | 🟡 |

### Historique & filtres serveur
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ADMIN-020 | Onglet Historique | Admin | « Historique » | Requête serveur `neq(status,pending)` triée desc | 🟡 |
| BOX-ADMIN-021 | Filtre statut/client/ville/adresse | Historique | Choisir filtres | Requêtes serveur cumulées ; options via RPC `admin_order_filters` (admin-only) | 🟡 |
| BOX-ADMIN-022 | Filtre montant min/max débounce | — | Taper montants | Débounce 400 ms ; `parseFloat` NaN ignoré (pas de filtre) | 🟡 |
| BOX-ADMIN-023 | Montant min > max | — | min=100 max=10 | Requête `gte 100 AND lte 10` → 0 résultat, message « aucune commande » | 🟡 |
| BOX-ADMIN-024 | Montant négatif / lettres | — | Saisir `-5`, `abc` | `min=0` HTML ; `abc`→NaN ignoré | 🟡 |
| BOX-ADMIN-025 | Reset filtres | Filtres actifs | « Réinitialiser » | Tous remis à `all`/vide | 🟡 |
| BOX-ADMIN-026 | File d'attente livreur (bandeau) | Commande ready sans livreur | — | Bandeau « en attente d'un livreur » listant les `pending_assignment` | 🟠 |
| BOX-ADMIN-027 | Injection SQL via filtre adresse/ville | — | Valeur avec `' OR 1=1--` | PostgREST paramétré → traité comme littéral, aucune injection | 🔴 |

---

## 7. Livreur & Assignation (BOX-DRV)

### Écran livreur
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-DRV-001 | `/livreur` redirige | Livreur | Aller `/livreur` | Redirect `/driver/orders` | 🟡 |
| BOX-DRV-002 | Liste propositions + livraisons | Livreur avec commandes assignées | `/driver/orders` | Propositions (ready) avec compte à rebours 2 min + livraisons (delivering) | 🟠 |
| BOX-DRV-003 | Compte non-livreur | Client sur `/driver/orders` | — | `livreur` maybeSingle null → « Aucune livraison », provider inerte | 🟡 |
| BOX-DRV-004 | Accepter proposition (ready→delivering) | Proposition active | « Accepter » | Update guardé `.eq(assigned_livreur_id).eq(status,ready)` renvoie la ligne ; sinon toast « réattribuée » | 🟠 |
| BOX-DRV-005 | Accepter après expiration proposition | Timer à 0 | « Accepter » | Bouton `disabled` (secs<=0) ; si contourné, 0 ligne → toast « Trop tard » | 🟠 |
| BOX-DRV-006 | Accepter proposition déjà réassignée | Cron a repris la commande | « Accepter » | `.select("id")` vide → toast « Trop tard : réattribuée » | 🟠 |
| BOX-DRV-007 | Marquer livrée | Delivering | « Livrée » | Update guardé `.eq(status,delivering)` | 🟠 |
| BOX-DRV-008 | Itinéraire Google Maps | Détail commande | « Itinéraire » | `window.open` synchrone (geste) puis géoloc async → pas de popup bloqué ; fallback sans origine | 🟡 |
| BOX-DRV-009 | Itinéraire sans coords ni adresse | Commande sans lat/lng/address | « Itinéraire » | Toast « Adresse indisponible », pas d'onglet vide | 🟡 |
| BOX-DRV-010 | Photo logement (repérage) | Adresse avec photo | Ouvrir détail | URL signée chargée (RLS livreur assigné) ; absente = rien | 🟡 |

### Assignation serveur (worker + cron)
| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-DRV-020 | Assignation immédiate à « prête » | 1 livreur libre | Admin « Prête » | `process_delivery_assignments` propose au 1ᵉ libre, `assignment_expires_at=now+2min` | 🟠 |
| BOX-DRV-021 | Timeout proposition → rotation | Livreur n'accepte pas en 2 min | Attendre + cron | Proposition relâchée, livreur ajouté à `tried_livreur_ids`, réoffre au suivant | 🟠 |
| BOX-DRV-022 | Aucun livreur libre → file | Tous occupés/inactifs | « Prête » | `pending_assignment=true`, `tried_livreur_ids` reset, notif admin **une seule fois** (transition false→true) | 🟠 |
| BOX-DRV-023 | Livreur libéré reprend la file | File non vide, un livreur livre | Cron suivant | Commande en file réoffre au livreur libéré | 🟠 |
| BOX-DRV-024 | Livreur « libre » = pas delivering + pas de proposition non expirée | Livreur avec proposition active | — | Exclu tant que sa proposition n'a pas expiré (sous-requête) | 🟠 |
| BOX-DRV-025 | Cron pg_cron indisponible | Cron désactivé | Timeout proposition | Aucune reprise auto → commande bloquée en `ready` assignée à un livreur passif ; le clic admin « Prête » ne rejoue pas → vérifier fallback | 🟠 |
| BOX-DRV-026 | Deux livreurs acceptent la même proposition | Course (théorique : 1 seul assigné) | 2 clics « Accepter » | Seul l'assigné (`assigned_livreur_id`) matche ; l'autre voit 0 ligne | 🟠 |
| BOX-DRV-027 | Sécurité `admin_process_assignments` par non-admin | Client appelle la RPC | Appel direct | `has_role(admin)` faux → exception « not authorized » | 🔴 |

---

## 8. Adresses & Carte (BOX-ADDR)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-ADDR-001 | Ajouter adresse via carte | Connecté | Compte/complete-profile → « Ajouter » → placer marqueur → Confirmer → détails → Enregistrer | Ligne insérée dans `addresses` avec lat/lng du marqueur | 🟠 |
| BOX-ADDR-002 | Limite 5 adresses (client) | 5 adresses | « Ajouter » | Bouton `disabled`, message « Limite de 5 atteinte » | 🟡 |
| BOX-ADDR-003 | Contournement limite 5 (serveur) | 5 adresses | Insert direct 6ᵉ via PostgREST | **Aucune contrainte serveur** trouvée → 6ᵉ acceptée → limite purement cliente ⚠️ | 🟠 |
| BOX-ADDR-004 | Adresse par défaut unique | Plusieurs adresses | Définir défaut | `setAsDefault` clear tous puis set 1 ; **non atomique** : si le 2ᵉ update échoue → 0 défaut | 🟠 |
| BOX-ADDR-005 | Suppression adresse par défaut | Défaut + autres | Supprimer défaut | Pas d'auto-promotion ; prompt « choisir une nouvelle défaut » | 🟡 |
| BOX-ADDR-006 | Suppression via `confirm()` natif | — | Supprimer | `window.confirm` bloque ; annuler = no-op | 🟡 |
| BOX-ADDR-007 | Appartement sans étage/porte | Type = apartment | Enregistrer sans étage | Toast « Étage et n° de porte requis » | 🟡 |
| BOX-ADDR-008 | Recherche Nominatim | Étape carte | Chercher « Tunis » | Résultats listés ; clic recentre | 🟡 |
| BOX-ADDR-009 | Nominatim aucun résultat | Requête absurde | Chercher `zzzzzz` | Toast « Aucun résultat » | 🟡 |
| BOX-ADDR-010 | Nominatim indisponible / rate-limit (429) | Spammer la recherche | Rechercher | `res.ok` faux → throw → toast « Recherche indisponible » ; pas de crash | 🟠 |
| BOX-ADDR-011 | Reverse-geocode échoue | Couper réseau à « Confirmer position » | Confirmer | `reverseFailed=true`, champ adresse vide éditable manuellement, ville conservée | 🟠 |
| BOX-ADDR-012 | Géocodage restaurant échoue (centre initial) | Nominatim down au montage | Ouvrir carte (ajout) | `centerError` → écran « Impossible de localiser » + « Réessayer » | 🟠 |
| BOX-ADDR-013 | « Ma position » permission refusée | Bloquer géoloc | « Ma position » | Toast « Position indisponible : … » | 🟡 |
| BOX-ADDR-014 | Marqueur draggable | Carte affichée | Glisser le marqueur | `setMarker` mis à jour ; coords affichées 5 déc. | 🟡 |
| BOX-ADDR-015 | Photo logement JPG/PNG ≤ 2 Mo | — | Ajouter photo valide | Aperçu + compression (1280px, JPEG 0.8) à l'upload | 🟡 |
| BOX-ADDR-016 | Photo type invalide (GIF/HEIC) | — | Choisir GIF | `validateAddressPhoto` → « Format non supporté » | 🟡 |
| BOX-ADDR-017 | Photo > 2 Mo | — | Choisir 5 Mo | « Image trop lourde » (aussi bloqué par bucket `file_size_limit`) | 🟡 |
| BOX-ADDR-018 | Upload photo échoue mais adresse OK | Forcer erreur storage | Enregistrer | Toast warning « adresse enregistrée mais photo non envoyée » (pas d'échec global) | 🟠 |
| BOX-ADDR-019 | Aperçu photo signée expirée/cassée | URL signée invalide | Éditer adresse | `onError` → `previewBroken` → bouton « en ajouter une » | 🟡 |
| BOX-ADDR-020 | Retirer photo existante | Adresse avec photo | Trash → Enregistrer | `photo_url=null` en base | 🟡 |
| BOX-ADDR-021 | Adresse hors zone enregistrable | Point > 7 km | Enregistrer | Enregistrement autorisé (contrôle zone au checkout, pas ici) ; badge « Hors zone » sur `/compte` | 🟡 |
| BOX-ADDR-022 | Bottom nav chevauche bouton Confirmer | Mobile avec nav | Étape carte | `--bottom-nav-height` runtime dégage le bouton | 🟡 |
| BOX-ADDR-023 | Adresse texte très longue / emojis | — | Coller 2000 car. + emojis | Stocké tel quel (`text`) ; vérifier affichage tronqué (line-clamp) et charte « pas d'emojis » | 🟡 |
| BOX-ADDR-024 | Carte Leaflet en SSR | Route `ssr:false` | Charger | Pas d'accès `window` en SSR (routes carte en `ssr:false`) | 🟠 |

---

## 9. Géolocalisation & Zone (BOX-GEO)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-GEO-001 | Adresse en zone (< 7 km) | Adresse à 3 km | Panier | Bouton actif, pas de bandeau | 🟠 |
| BOX-GEO-002 | Adresse exactement 7 km | Point à ~7,000 km | Panier | `<= 7` inclusif → en zone (vérifier cohérence client/serveur, tous deux `> radius` = rejet) | 🟡 |
| BOX-GEO-003 | Adresse hors zone (> 7 km) | Point à 10 km | Panier | Bouton « Adresse hors zone » désactivé, bandeau ambre | 🟠 |
| BOX-GEO-004 | Coordonnées nulles (0,0) | Adresse lat=0 lng=0 | Confirmer | Client `hasValidCoords` false → « localisation invalide » ; serveur trigger rejette aussi | 🟠 |
| BOX-GEO-005 | Coordonnées null/undefined | Adresse sans lat/lng | Confirmer | Fail-closed : `distanceKm==null` → toast « sans localisation valide » | 🟠 |
| BOX-GEO-006 | Coordonnées NaN | Injecter NaN | Confirmer | `Number.isFinite` false → hors zone | 🟠 |
| BOX-GEO-007 | Contournement client → trigger serveur | Appel direct insert `orders` hors zone | PostgREST | Trigger `enforce_delivery_zone` lève `check_violation` | 🔴 |
| BOX-GEO-008 | Cohérence formule client/serveur | Point limite | Comparer | Même Haversine (constantes identiques) → pas de divergence de bordure | 🟡 |
| BOX-GEO-009 | Antiméridien / latitudes extrêmes | lat=90/lng=180 | — | Haversine borné (asin(sqrt) ≤ 1) → pas de NaN | 🟡 |
| BOX-GEO-010 | Tracking : dest = profil sinon commande | Delivering | `/orders/$id/tracking` | `profileCoords` prioritaire, sinon `orders.lat/lng`, sinon « position indisponible » | 🟡 |

---

## 10. Notifications Push (BOX-PUSH)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-PUSH-001 | Activer push (client) | HTTPS, hors iframe | « Activer notifications » | Permission → subscribe → RPC `save_push_subscription(role=client)` | 🟠 |
| BOX-PUSH-002 | Activer push (livreur) — ⚠️ | Livreur | Activer | `push.ts` passe `role='livreur'` ; l'RPC `20260726` **rejette** les rôles hors `('client','admin')` → vérifier que `20260727_livreur_push_role.sql` élargit bien la contrainte, sinon **échec silencieux livreur** | 🔴 |
| BOX-PUSH-003 | Permission refusée | — | Refuser prompt | `{ok:false,error:"Permission refusée"}`, toast | 🟡 |
| BOX-PUSH-004 | Push non supporté (iOS Safari ancien) | Navigateur sans PushManager | Charger | `isPushSupported` false → bouton masqué/inerte | 🟡 |
| BOX-PUSH-005 | Exécution en iframe (éditeur/preview) | Lovable preview | Activer | SW non enregistré, message « pas dispo dans l'aperçu » | 🟡 |
| BOX-PUSH-006 | Host de preview | `*.lovableproject.com` | Charger | SW non enregistré (log warn) | 🟡 |
| BOX-PUSH-007 | Même appareil, 2 comptes | Compte A puis B activent push | Activer sur B | RPC réattribue la ligne (`user_id=auth.uid()`) via `on conflict(endpoint)` — pas de conflit RLS | 🟠 |
| BOX-PUSH-008 | Abonnement expiré (404/410) | Endpoint révoqué | Envoi push serveur | `send-order-notification` supprime la ligne | 🟡 |
| BOX-PUSH-009 | Notification uniquement si statut change | Update sans changement de statut | Update timestamps | Webhook skip `status_unchanged` → pas de doublon | 🟠 |
| BOX-PUSH-010 | Push message chat | Message envoyé | Insert `order_messages` | Trigger `notify_order_message` (pg_net async) → push à l'autre participant | 🟠 |
| BOX-PUSH-011 | VAPID public/privé désaccordés | Clés incohérentes | Envoi | FCM rejette ; vérifier alignement `VITE_VAPID_PUBLIC_KEY` ↔ secret privé | 🟠 |
| BOX-PUSH-012 | `hasActiveSubscription` vs permission | Permission granted mais ligne absente | Vérifier état | Retourne false si aucune ligne (endpoint) → UI cohérente | 🟡 |
| BOX-PUSH-013 | Nouveau SW prend le contrôle | Déploiement nouveau bundle | `controllerchange` | Reload **une seule fois** (`refreshing`) — vérifier pas de boucle de reload | 🟠 |

---

## 11. Realtime & Chat (BOX-RT)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-RT-001 | Chat client↔livreur (delivering) | Commande delivering | `/orders/$id/tracking` | Messages chargés + Realtime INSERT filtré `order_id` | 🟠 |
| BOX-RT-002 | Chat hors delivering | Statut ready/delivered | Ouvrir tracking | Page « suivi indisponible » ; RLS `can_access_order_chat` bloque insert/select | 🟠 |
| BOX-RT-003 | Dédup message (id) | Reconnexion / echo | — | `appendMessage` ignore les ids déjà présents | 🟡 |
| BOX-RT-004 | Envoi message vide/espaces | — | Envoyer `   ` | `trim` → bouton `disabled`, pas d'insert | 🟡 |
| BOX-RT-005 | Message maxLength 500 | — | Coller > 500 | `maxLength` tronque | 🟡 |
| BOX-RT-006 | Usurpation expéditeur | Insert avec `sender_id` ≠ soi | Appel direct | RLS `with check sender_id=auth.uid()` → rejet | 🔴 |
| BOX-RT-007 | Nom de l'autre participant | Message reçu | — | `profiles` lisible via `shares_active_delivery` seulement pendant delivering | 🟡 |
| BOX-RT-008 | WS chat coupé puis reconnecté | Couper réseau | Reconnecter | Nouveaux messages via reco ; **messages émis pendant la coupure non re-fetchés** → trou possible | 🟠 |
| BOX-RT-009 | Tracking position broadcast | Livreur delivering | Client ouvre map | `DriverBroadcastProvider` diffuse position ; client reçoit via `order-tracking-{id}` | 🟠 |
| BOX-RT-010 | `request-position` au join | Client rejoint tard | — | Livreur renvoie dernière position connue ou quick-fix | 🟡 |
| BOX-RT-011 | GPS perdu (onglet masqué) | Livreur onglet en fond | — | `gpsLost=true` (visibilitychange) → statut « signal perdu » côté client | 🟡 |
| BOX-RT-012 | Broadcast pour plusieurs commandes | Livreur 2 livraisons | — | Une seule surveillance GPS diffusée à tous les channels actifs | 🟠 |
| BOX-RT-013 | Fin de livraison arrête le broadcast | Marquer livrée | — | Commande quitte delivering → channel retiré, `broadcasting=false` | 🟠 |
| BOX-RT-014 | Logs de diagnostic en prod | — | Console | `console.log [driver-broadcast]` verbeux laissé en prod → bruit/fuite d'info mineure | 🟡 |
| BOX-RT-015 | Admin channel `*` sur toute la table | Volume élevé | — | `admin-orders` écoute tous les `orders` → recharge complète à chaque event → charge/perf à volume | 🟠 |
| BOX-RT-016 | Realtime désactivé (RLS Realtime) | — | Client sur commande d'autrui | Realtime respecte RLS → pas de fuite d'events d'autres commandes | 🔴 |

---

## 12. Codes promo (BOX-PROMO)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-PROMO-001 | Bannière WELCOME10 | Menu | Cliquer bannière | `/app?promo=WELCOME10` → `applyPromo` stocke le code | 🟡 |
| BOX-PROMO-002 | Réduction -10 % 1ère commande | Aucune commande passée | Panier | `-10%` arrondi 3 déc. ; total réduit | 🟠 |
| BOX-PROMO-003 | Offre déjà utilisée | Commande existante (pending…delivered) | Panier | `welcomeEligible=false` → « Offre déjà utilisée », pas de réduction | 🟠 |
| BOX-PROMO-004 | Éligibilité fail-open sur erreur | Forcer erreur lecture `orders` | Panier | `setWelcomeEligible(true)` → réduction accordée (fail-open) — vérifier acceptable métier | 🟠 |
| BOX-PROMO-005 | Code invalide | `?promo=XYZ` | — | `normalizePromoCode` ≠ WELCOME10 → aucune réduction (0) | 🟡 |
| BOX-PROMO-006 | Casse/espaces du code | `?promo= welcome10 ` | — | Trim + upper → WELCOME10 reconnu | 🟡 |
| BOX-PROMO-007 | Promo persistée puis commande | WELCOME10 appliqué | Confirmer | `clear()` retire `box_promo` (offre consommée) | 🟡 |
| BOX-PROMO-008 | Réduction sur total serveur | Éligible | Confirmer | `orders.total` = total réduit ; **aucune revalidation serveur** de l'éligibilité → un client peut forcer `total` réduit via insert direct ⚠️ | 🟠 |
| BOX-PROMO-009 | Total négatif (remise > sous-total) | Sous-total minuscule | — | -10% ne rend jamais négatif ; vérifier arrondi ne produit pas total < 0 | 🟡 |

---

## 13. Profil & Compte (BOX-PROF)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-PROF-001 | Éditer nom/téléphone | Connecté | `/compte` → Modifier → Enregistrer | Upsert `profiles` ; nom < 2 car. rejeté | 🟡 |
| BOX-PROF-002 | Téléphone déjà utilisé | Numéro d'un autre compte | Enregistrer | Erreur `23505`/`profiles_phone_unique` → « déjà utilisé par un autre compte » | 🟠 |
| BOX-PROF-003 | Téléphone vidé → null | Champ vide | Enregistrer | `phone=null` (hors index unique partiel) | 🟡 |
| BOX-PROF-004 | Ajouter/changer email | Connecté | Saisir email → « Modifier » | `updateUser({email})` envoie confirmation ; `new_email` en attente affiché | 🟠 |
| BOX-PROF-005 | Email invalide | — | `foo@bar` (sans TLD) | Regex rejette → toast | 🟡 |
| BOX-PROF-006 | Email déjà utilisé | Email d'un autre compte | Enregistrer | `email_exists` → toast « déjà utilisée » | 🟠 |
| BOX-PROF-007 | Lier compte Google | Connecté sans Google | « Lier » | `linkIdentity` redirige Google → retour `/compte` | 🟡 |
| BOX-PROF-008 | Suppression compte (confirmation) | Connecté | Dialog → taper « SUPPRIMER » | Bouton actif seulement si texte exact ; Edge Function `delete-account` (JWT, pas d'id du body) | 🔴 |
| BOX-PROF-009 | delete-account sans token | Appel direct sans Authorization | — | 401 `missing_authorization` | 🔴 |
| BOX-PROF-010 | delete-account id d'autrui dans le body | Fournir `user_id` d'un tiers | Appel | Ignoré : identité = JWT uniquement → impossible de supprimer autrui | 🔴 |
| BOX-PROF-011 | delete-account méthode GET | GET sur la fonction | — | 405 Method not allowed | 🟡 |
| BOX-PROF-012 | Cascade suppression | Compte avec commandes/adresses | Supprimer | FK `ON DELETE CASCADE` + delete best-effort `push_subscriptions/addresses/favorites` | 🟠 |
| BOX-PROF-013 | Avatar chargement | Connecté | `/compte` | `ProfileAvatar` ; header avatar ; fallback icône | 🟡 |
| BOX-PROF-014 | Profil chargé mais erreur `profiles` | RLS/absence ligne | `/compte` | Fallback metadata `full_name`, pas de crash | 🟡 |

---

## 14. Sécurité & RLS (BOX-SEC)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-SEC-001 | Client lit commande d'autrui | Client A, id de B | `select orders` direct | RLS `orders_owner_select` → 0 ligne | 🔴 |
| BOX-SEC-002 | Client update statut commande | Client | `update orders set status='accepted'` | Pas de policy client UPDATE (seulement admin/livreur/owner-cancel guardé) → refus | 🔴 |
| BOX-SEC-003 | Client s'auto-attribue admin | Client | `insert user_roles(role=admin)` | Aucun GRANT INSERT `user_roles` à `authenticated` → refus | 🔴 |
| BOX-SEC-004 | Accès `/admin` sans rôle | Client | Naviguer/forcer | `beforeLoad` redirect + RLS bloquent les données | 🔴 |
| BOX-SEC-005 | Client lit tous les profils | Client | `select profiles` | RLS `profiles_self_select` (+ chat delivering) → seulement soi/participant | 🔴 |
| BOX-SEC-006 | Livreur voit commandes non assignées | Livreur | `select orders` | RLS `orders_livreur_select_assigned` → seulement les siennes | 🟠 |
| BOX-SEC-007 | Livreur lit adresse arbitraire | Livreur | `select addresses id=X` | RLS admin/livreur read limité aux commandes assignées (migration `addresses_admin_livreur_read`) | 🟠 |
| BOX-SEC-008 | Photo logement privée | Non-propriétaire | Accès objet storage | Bucket privé + policies (owner/admin/livreur assigné) → refus sinon | 🟠 |
| BOX-SEC-009 | Injection SQL inputs (nom, note, adresse, chat) | — | `'; DROP TABLE orders;--` | PostgREST paramétré → littéral stocké, aucune exécution | 🔴 |
| BOX-SEC-010 | XSS via champs texte | — | `<script>alert(1)</script>` dans note/nom/chat | React échappe le rendu ; vérifier aucun `dangerouslySetInnerHTML` | 🟠 |
| BOX-SEC-011 | RPC admin par non-admin | Client | `admin_order_filters`, `admin_process_assignments` | Guard `has_role(admin)` → exception ; grant retiré à anon | 🔴 |
| BOX-SEC-012 | `save_push_subscription` rôle arbitraire | — | `p_role='superadmin'` | Rejet `22023` (rôle invalide) | 🟠 |
| BOX-SEC-013 | SECURITY DEFINER search_path | — | Audit fonctions | Toutes `SET search_path = public` → pas de hijack de schéma | 🟠 |
| BOX-SEC-014 | Anon exécute fonctions sensibles | Anon | Appel `has_role`, `expire_stale_orders`, `handle_new_user` | `REVOKE ... FROM anon` → refus | 🔴 |
| BOX-SEC-015 | Falsifier `total`/`distance_km` à l'insert | Client | Insert `orders` total=0, distance=1 | `distance_km` écrasé par trigger ; **`total` NON revalidé serveur** → client peut sous-facturer ⚠️ | 🟠 |
| BOX-SEC-016 | Falsifier `user_id` d'une commande | Client | Insert `orders user_id=autre` | `orders_owner_insert with check auth.uid()=user_id` → refus | 🔴 |
| BOX-SEC-017 | Créer items pour commande d'autrui | Client | Insert `order_items order_id=B` | `order_items_owner_insert` exige propriété de la commande → refus | 🔴 |
| BOX-SEC-018 | CORS delete-account `*` | — | Appel cross-origin | `Access-Control-Allow-Origin: *` mais protégé par JWT → acceptable ; vérifier pas d'action sans token | 🟡 |
| BOX-SEC-019 | Endpoint push d'un tiers volé | Endpoint connu | Insert via RPC | RPC réassigne `user_id=auth.uid()` → vol de l'endpoint réattribue à soi (DoS abonnement d'autrui ?) — vérifier impact | 🟡 |
| BOX-SEC-020 | Clé VAPID privée exposée | Audit bundle | Grep front | Seule la **publique** est dans `push.ts` ; la privée reste secret serveur | 🔴 |
| BOX-SEC-021 | `.env` committé | — | Inspecter repo | Vérifier que `.env` (présent) ne contient pas de secrets sensibles (service_role) versionnés | 🔴 |

---

## 15. PWA / Offline / Service Worker (BOX-PWA)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-PWA-001 | Installation PWA | Domaine réel HTTPS | Installer | `isStandaloneApp` → `/` redirige vers `/app` | 🟡 |
| BOX-PWA-002 | Perte réseau pendant commande | Confirmer puis couper | Confirmer offline | Insert échoue → toast erreur ; panier conservé (pas de `clear()` avant succès) | 🟠 |
| BOX-PWA-003 | Menu offline (cache SW) | Déjà chargé une fois | Recharger offline | Selon stratégie SW : shell servi ; données Supabase indisponibles → état de chargement/erreur | 🟠 |
| BOX-PWA-004 | Cache SW périmé après déploiement | Ancien SW actif | Nouveau déploiement | `updateViaCache:none` + `reg.update()` + reload sur `controllerchange` → bundle à jour | 🟠 |
| BOX-PWA-005 | Boucle de reload SW | Déploiements rapprochés | — | Garde `refreshing` empêche la boucle | 🟠 |
| BOX-PWA-006 | Realtime après retour online | Coupure puis online | — | Reconnexion WS ; vérifier re-sync des statuts (cf. BOX-TRACK-014) | 🟠 |
| BOX-PWA-007 | Géoloc en contexte non sécurisé | HTTP (non-HTTPS) | « Ma position » | API géoloc bloquée → toast erreur | 🟡 |

---

## 16. UI Responsive & Accessibilité (BOX-UI)

> À exécuter à **375px (mobile)**, **768px (tablette)**, **1440px (desktop)** pour chaque écran ci-dessous.

| ID | Titre | Écran | Résultat attendu | Sév. si bug |
|----|-------|-------|------------------|-------------|
| BOX-UI-001 | Menu grille 2 col | `/app` | 2 colonnes stables ; cartes 280px ; header sticky ; carrousel swipe | 🟡 |
| BOX-UI-002 | Détail plat modal | `/app` (détail) | Feuille 92dvh, footer bouton visible au-dessus nav+clavier | 🟠 |
| BOX-UI-003 | Panier | `/panier` | Récap lisible, bouton pleine largeur, header noir sticky | 🟡 |
| BOX-UI-004 | Admin liste + filtres | `/admin` | Filtres `flex-wrap` ; tableau/cartes non tronqués ; scroll horizontal tabs | 🟡 |
| BOX-UI-005 | Carte adresse plein écran | AddAddress | Carte Leaflet plein écran ; barre recherche + confirmer non chevauchés | 🟠 |
| BOX-UI-006 | Écran suivi commande | `/commande/$id` | Ring + countdown centrés ; boutons accessibles | 🟡 |
| BOX-UI-007 | Écran livreur | `/driver/orders` | Cartes propositions/livraisons ; modal détail scrollable (92vh) | 🟡 |
| BOX-UI-008 | Chat | tracking | Bulles alignées ; zone scroll `max-h-72` ; input + envoi | 🟡 |
| BOX-UI-009 | Vitrine marketing | `/` (navigateur) | Rendu correct desktop/mobile ; font Anton chargée (CSP) | 🟡 |
| BOX-UI-010 | Débordement horizontal | tous | Aucun scroll horizontal parasite à 375px | 🟡 |
| BOX-UI-011 | Aria-labels boutons icônes | tous | Boutons icône ont `aria-label` (supprimer, fermer, filtrer…) | 🟡 |
| BOX-UI-012 | Contraste badges/texte | tous | Badges statut lisibles (warning/success/destructive) | 🟡 |
| BOX-UI-013 | Focus clavier / navigation | formulaires | Champs focusables, ordre logique ; modales piègent le focus | 🟡 |
| BOX-UI-014 | Toasts empilés (sonner) | actions rapides | Pas de recouvrement illisible | 🟡 |
| BOX-UI-015 | Orientation paysage mobile | détail plat | `orientationchange` recalcule le viewport (footer visible) | 🟡 |

---

## 17. Données invalides & i18n (BOX-DATA)

| ID | Titre | Préconditions | Étapes | Résultat attendu | Sév. si bug |
|----|-------|---------------|--------|------------------|-------------|
| BOX-DATA-001 | Nom avec caractères spéciaux | — | `O'Brien-Éà`, `<>&` | Stocké/affiché échappé, pas de crash SQL/HTML | 🟡 |
| BOX-DATA-002 | Emojis (interdits par charte) | — | Nom/note/adresse avec 🍔😀 | **Aucune validation anti-emoji** → acceptés ; vérifier conformité charte | 🟡 |
| BOX-DATA-003 | Champs vides requis | — | Soumettre formulaires vides | `required`/validations manuelles bloquent (nom, adresse…) | 🟡 |
| BOX-DATA-004 | Texte très long (10k car.) | — | Coller dans note (pas de maxLength) / instructions (500) | Note article **sans maxLength** → 10k stockés ; instructions tronquées 500 | 🟡 |
| BOX-DATA-005 | Espaces seuls | — | `"   "` dans nom | `trim` → rejet « Nom invalide » | 🟡 |
| BOX-DATA-006 | Nombres : quantité 0/négative | — | Forcer qty négative | UI empêche (min 1) ; insert direct qty=0 → pas de contrainte CHECK serveur (`qty INTEGER`) ⚠️ | 🟡 |
| BOX-DATA-007 | Prix décimaux TND (3 déc.) | — | Montants `.000` | `fmt` affiche 3 décimales ; `NUMERIC(10,3)` en base | 🟡 |
| BOX-DATA-008 | Total overflow `NUMERIC(10,3)` | — | Panier > 9 999 999.999 | Insert échoue (dépassement précision) → toast erreur | 🟡 |
| BOX-DATA-009 | Unicode RTL / zero-width | — | Injecter caractères de contrôle | Affichage sans casser la mise en page | 🟡 |
| BOX-DATA-010 | Dates/heures locales | — | `toLocaleTimeString` | Cohérence fuseau ; pas d'« Invalid Date » si champ null | 🟡 |
| BOX-DATA-011 | Cohérence libellés FR | tous | Parcourir | Textes en français cohérents (statuts, erreurs) | 🟡 |

---

## Annexe — Bugs suspectés à investiguer en priorité

Points relevés pendant l'analyse statique, à confirmer par test :

1. **BOX-ORD-010/011 — Atomicité checkout** : `orders`, `order_items`, `order_item_options` insérés en 3 requêtes séparées sans transaction. Un échec intermédiaire laisse une commande incohérente et le panier non vidé (risque de double envoi). 🔴
2. **BOX-AUTH-034 — Non-null assertion** : `userRes.user!.id` dans `confirm()` si la session expire pendant le checkout → crash potentiel. 🔴
3. **BOX-PUSH-002 — Rôle livreur** : `push.ts` envoie `role='livreur'` à une RPC dont une version rejette ce rôle. Vérifier la migration `20260727_livreur_push_role`. 🔴
4. **BOX-ADMIN-015/016, BOX-TRACK-007 — Faux positifs de toast** : les updates guardés par `.eq(status, X)` affichent « succès » même quand 0 ligne n'est modifiée (course/double-clic). 🟠
5. **BOX-ADDR-003 — Limite 5 adresses cliente seulement** : aucune contrainte serveur. 🟠
6. **BOX-SEC-015/BOX-PROMO-008 — `total` non revalidé serveur** : le client fixe `orders.total` ; seule `distance_km` est recalculée. Sous-facturation possible par insert direct. 🟠
7. **BOX-TRACK-008 — « Recommander »** génère des `itemId` synthétiques ne correspondant à aucun `menu_items` (pas d'image, prix figé potentiellement périmé). 🟠
8. **BOX-TRACK-012 — Commande non autorisée** : reste bloquée sur « Chargement… » (pas d'état 404/erreur). 🟠
9. **BOX-ORD-023 — `useEffect` éligibilité promo** avec tableau de dépendances vide lisant `hasWelcomePromo`. 🟡
10. **BOX-RT-014/BOX-RT-008 — Trous Realtime** : pas de re-fetch après reconnexion WS → events manqués pendant coupure non rattrapés. 🟠
11. **BOX-MENU-013 — Préfixe « Pizza »** basé sur `category_id` au lieu du nom de catégorie → probablement jamais appliqué. 🟡
12. **BOX-RT-014 — Logs `console.log` de diagnostic** laissés en production (DriverBroadcastProvider, push). 🟡
13. **BOX-DATA-006 — Absence de CHECK serveur** sur `orders.qty`/`total` (quantités ≤ 0 possibles par insert direct). 🟡

---

_Document généré par analyse statique exhaustive du dépôt (routes, composants, hooks, `src/lib`, migrations SQL, Edge Functions). Les cas marqués ⚠️ signalent un écart probable entre garde cliente et garde serveur._
