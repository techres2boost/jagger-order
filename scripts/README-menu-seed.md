# BOX menu seed — image upload

The menu **categories, dishes and prices** are already seeded in the database
(4 categories, 44 dishes, 44 prices). Only the **dish images** still need to be
uploaded to Supabase Storage.

They could not be uploaded from the automation environment because its network
policy blocks outbound HTTPS to `*.supabase.co`. Run the upload once from a
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

```bash
SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' \
node scripts/upload-menu-images.mjs
```

Options:

- `--menu <path>` — point at the images folder (default `menu`).
- `--force` — re-upload even for dishes that already have an image.

The script matches each image to a dish by **normalised name** (lowercase,
accents stripped, hyphens → spaces), uploads it to `dish-images`, and sets
`menu_items.image_url` to the public URL. It is idempotent: dishes that already
have an image are skipped unless `--force` is passed. At the end it prints any
image with no matching dish, any ambiguous match, and any dish still without an
image.

## Verify in the admin panel

1. Sign in as an admin and open **/admin/menu**.
2. You should see the 4 categories (Sandwichs, Burgers, Boissons, Pizzas) with
   12 / 8 / 9 / 15 dishes, each with its price and, after running the script,
   its image.
