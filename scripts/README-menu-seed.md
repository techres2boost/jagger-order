# Jagger — seed du menu : images

Les **catégories, plats, prix, flags « featured » et options** sont posés par
SQL (`supabase/bootstrap/03_seed_menu.sql` — 22 catégories, 121 plats, 121 prix,
8 mis en avant, 1 groupe d'options à 9 choix). Seules les **images des plats**
restent à téléverser dans le bucket Supabase Storage `dish-images`.

Elles ne peuvent pas être envoyées depuis l'environnement d'automatisation : sa
politique réseau bloque les sorties HTTPS vers `*.supabase.co` (et
`storage.objects` n'est pas modifiable en SQL — un trigger l'interdit). Lancez
le téléversement une fois depuis une machine avec un accès internet normal
(GitHub Codespace, poste local…).

## Prérequis

- Le dossier `menu/` à la racine du dépôt, avec ses 22 sous-dossiers, les 117
  images `.webp` et `menu/manifest.json`.
- Node 18+ et les dépendances installées (`npm ci`) — le script utilise
  `@supabase/supabase-js`, déjà présent.
- La clé **service_role** du projet (Dashboard → Project Settings → API).
  Téléverser dans `dish-images` est réservé aux admins (RLS) ; la service role
  contourne la RLS. **Ne committez jamais cette clé.**
- Le schéma et le seed du menu déjà appliqués (les plats doivent exister pour
  recevoir leur `image_url`).

## Lancer

Premier passage après un seed complet du menu (vide aussi le bucket des images
rattachées aux anciens identifiants de plats) :

```bash
SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' \
node scripts/upload-menu-images.mjs --reset-bucket
```

Passages suivants (idempotent — saute les plats qui ont déjà une image) :

```bash
SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' \
node scripts/upload-menu-images.mjs
```

Options :

- `--reset-bucket` — supprime tous les objets existants de `dish-images` avant
  le téléversement. À utiliser une seule fois, juste après un re-seed complet.
- `--menu <chemin>` — dossier des images (défaut : `menu`).
- `--force` — re-téléverse même les plats qui ont déjà une image.
- `SUPABASE_URL` — surcharge l'URL du projet (défaut : celui de Jagger).

## Appariement image ↔ plat

Le script lit `menu/manifest.json`, qui associe chaque fichier à un couple
**(catégorie, plat)** exact. Ce manifeste est nécessaire — un appariement par
nom normalisé ne suffirait pas :

- plusieurs fichiers ne portent pas le nom du plat (`tanino.webp` → *TONINO*,
  `fondant au choxolat.webp` → *Fondant au Chocolat*, `mexicane.webp` →
  *MEXICAINE*, `frerrero rocher.webp` → *Ferrero Rocher*, `Americano
  Nespresso.webp` → *Espresso Americano*…) ;
- deux plats homonymes existent dans des catégories différentes : **Detox**
  (Cocktails et Mojitos) et **Overdose** (Crêpes sucrées et Gaufres sucrées).
  En base, l'unicité des noms est par catégorie, pas globale.

Le manifeste est régénéré avec le seed :

```bash
node scripts/generate-menu-seed.mjs
```

Chaque image est envoyée sous `<menu_item_id>-<timestamp>.webp` avec un
`cacheControl` d'un an (31536000), comme les téléversements faits depuis le
panneau d'administration, puis `menu_items.image_url` reçoit l'URL publique.

En fin d'exécution, le script affiche : le nombre d'entrées du manifeste, les
téléversements, les plats sautés, les fichiers manquants, les entrées sans plat
correspondant en base, et les plats encore sans image.

## Plats sans image

4 plats n'ont pas de photo dans le dépôt et s'afficheront avec le visuel de
repli de l'application :

- **Pasta** — Puttanesca, Penne Poulet Pané, Penne Mare e Monti
- **Plats** — Cordon Bleu

Fournissez ces 4 images (≤ 100 Ko, format `.webp`) dans le sous-dossier de leur
catégorie, ajoutez le chemin sur le plat correspondant dans `src/data/menu.ts`,
régénérez, relancez le script. Elles peuvent aussi être ajoutées directement
depuis **/admin/menu**.

## Vérifier dans le panneau d'administration

1. Connectez-vous avec un compte admin et ouvrez **/admin/menu**.
2. Vous devez voir les 22 catégories dans l'ordre de la carte (Cafés →
   Boissons), avec 9/3/5/9/7/9/6/2/3/5/7/9/5/6/3/6/4/5/9/4/1/4 plats, chacun
   avec son prix.
3. 8 plats sont marqués « featured » : Café Brownies, Big Boss, Big Choc,
   BLACK JAGGER, Overdose (gaufre), Salade César, Lasagne alla Bolognese,
   Cordon Bleu. Ce choix est une proposition — ajustez-le librement depuis
   l'admin, c'est un simple interrupteur par plat.
4. Le plat **Chicha** porte le groupe d'options **Parfum** (choix unique,
   gratuit) avec ses 9 parfums.
5. Les images apparaissent après l'exécution du script.
