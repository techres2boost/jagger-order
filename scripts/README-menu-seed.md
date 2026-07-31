# BOX menu seed — image upload

The menu **categories, dishes, prices, featured flags and options/supplements**
are already seeded in the database (4 categories, 44 dishes, 44 prices, 4
featured, 2 option groups). Only the **dish images** still need to be uploaded
to Supabase Storage.

They could not be uploaded from the automation environment because its network
policy blocks outbound HTTPS to `*.supabase.co` (and `storage.objects` cannot be
mutated via SQL — a database trigger forbids it). Run the upload once from a
machine with normal internet access.

## Prerequisites

- The `menu/` folder at the repo root, with the sub-folders
  `Sandwich/ Burgers/ Boissons/ Pizzas/` and the dish images inside them.
- Node 18+ and the project dependencies installed (`npm ci`) — the script uses
  the already-present `@supabase/supabase-js`.
- The project **service_role** key (Supabase dashboard → Project Settings →
  API). Uploading to the `dish-images` bucket is admin-only, and the service
  role bypasses RLS. Never commit this key.

## Run

First run after a full menu re-seed (also empties the bucket of images tied to
the previous dishes):

```bash
SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' \
node scripts/upload-menu-images.mjs --reset-bucket
```

Subsequent runs (idempotent — skips dishes that already have an image):

```bash
SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' \
node scripts/upload-menu-images.mjs
```

Options:

- `--reset-bucket` — delete every existing object in `dish-images` before
  uploading. Use it once, right after a full re-seed, to clear images that were
  attached to the old dish IDs.
- `--menu <path>` — point at the images folder (default `menu`).
- `--force` — re-upload even for dishes that already have an image.

The script matches each image to a dish by **normalised name** (lowercase,
accents stripped, hyphens → spaces), uploads it to `dish-images`, and sets
`menu_items.image_url` to the public URL. At the end it prints any image with no
matching dish, any ambiguous match, and any dish still without an image.

## Verify in the admin panel

1. Sign in as an admin and open **/admin/menu**.
2. You should see the 4 categories (Sandwichs, Burgers, Boissons, Pizzas) with
   12 / 8 / 9 / 15 dishes, each with its price; the 4 popular dishes flagged as
   featured; and, for every Sandwich and Burger, the **Options** (max 4) and
   **Suppléments** (max 6) groups. Images appear after running the script.
