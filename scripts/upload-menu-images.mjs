#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Uploads the local menu/ images to the Supabase `dish-images` bucket and sets
// each menu_items.image_url to the resulting public URL.
//
// WHY THIS SCRIPT EXISTS
// The categories, menu_items, prices (menu_item_sizes), featured flags and
// options/supplements are seeded by SQL (supabase/bootstrap/03_seed_menu.sql).
// Only the image bytes remain: they cannot be uploaded from the automation
// sandbox because its egress policy blocks *.supabase.co (and storage.objects
// cannot be mutated via SQL — a trigger forbids it). Run this once from a
// machine with normal network access.
//
// USAGE
//   SUPABASE_SERVICE_ROLE_KEY='<service_role_key>' node scripts/upload-menu-images.mjs
//
// Full option list:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   node scripts/upload-menu-images.mjs [--menu ./menu] [--force] [--reset-bucket]
//
// - SUPABASE_URL defaults to the Jagger project below if unset.
// - The SERVICE ROLE key is required: uploading to dish-images is admin-only
//   (RLS), and the service role bypasses RLS. Keep it secret; never commit it.
// - Matching uses menu/manifest.json, which pairs each image file with an exact
//   (category, dish) couple. Regenerate it with:
//       node scripts/generate-menu-seed.mjs
//   A manifest is required rather than name-normalisation because several files
//   are not named after their dish ("tanino.webp" -> TONINO) and two dishes share
//   a name across categories ("Detox", "Overdose").
// - Idempotent: items that already have an image_url are skipped unless --force.
// - --reset-bucket : delete ALL existing objects in dish-images first (use it
//   once, after a full menu re-seed, to clear images tied to old dish IDs).
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "dish-images";
const DEFAULT_URL = "https://zouvaqadidzeieytanoa.supabase.co";

const args = process.argv.slice(2);
const force = args.includes("--force");
const resetBucket = args.includes("--reset-bucket");
const menuDir = (() => {
  const i = args.indexOf("--menu");
  return i !== -1 && args[i + 1] ? args[i + 1] : "menu";
})();

const url = process.env.SUPABASE_URL || DEFAULT_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("ERROR: set SUPABASE_SERVICE_ROLE_KEY (service_role, not anon).");
  process.exit(1);
}
if (!existsSync(menuDir)) {
  console.error(`ERROR: menu directory not found: ${menuDir}`);
  process.exit(1);
}

const manifestPath = join(menuDir, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(
    `ERROR: ${manifestPath} not found. Generate it with: node scripts/generate-menu-seed.mjs`,
  );
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const CONTENT_TYPE = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const norm = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Optionally empty the bucket first (objects from a previous seed reference old
// dish IDs and would otherwise linger as orphans).
if (resetBucket) {
  let removed = 0;
  for (;;) {
    const { data: objs, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 100 });
    if (listErr) {
      console.error("ERROR listing bucket:", listErr.message);
      process.exit(1);
    }
    if (!objs || objs.length === 0) break;
    const names = objs.map((o) => o.name);
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(names);
    if (rmErr) {
      console.error("ERROR removing objects:", rmErr.message);
      process.exit(1);
    }
    removed += names.length;
    if (objs.length < 100) break;
  }
  console.log(`reset-bucket: removed ${removed} existing object(s) from ${BUCKET}`);
}

// Dishes are unique per (category, name) in the database — index them the same
// way so cross-category homonyms stay distinguishable.
const { data: items, error } = await supabase
  .from("menu_items")
  .select("id, name, image_url, categories(name)");
if (error) {
  console.error("ERROR fetching menu_items:", error.message);
  process.exit(1);
}

const byKey = new Map();
for (const it of items) {
  byKey.set(`${norm(it.categories?.name ?? "")}/${norm(it.name)}`, it);
}

let uploaded = 0;
let skipped = 0;
const missingFile = [];
const noDbItem = [];
const matched = new Set();

for (const entry of manifest.images) {
  const path = join(menuDir, entry.file);
  if (!existsSync(path)) {
    missingFile.push(entry.file);
    continue;
  }
  const item = byKey.get(`${norm(entry.category)}/${norm(entry.dish)}`);
  if (!item) {
    noDbItem.push(`${entry.category} / ${entry.dish}`);
    continue;
  }
  matched.add(item.id);
  if (item.image_url && !force) {
    skipped++;
    continue;
  }
  const ext = extname(entry.file).slice(1).toLowerCase();
  const contentType = CONTENT_TYPE[ext];
  if (!contentType) {
    console.error(`FAIL ${entry.file}: unsupported extension .${ext}`);
    continue;
  }
  const bytes = readFileSync(path);
  const objectPath = `${item.id}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType,
    cacheControl: "31536000", // 1 an, comme les uploads de l'admin
    upsert: true,
  });
  if (up.error) {
    console.error(`FAIL upload ${entry.file}: ${up.error.message}`);
    continue;
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const upd = await supabase.from("menu_items").update({ image_url: publicUrl }).eq("id", item.id);
  if (upd.error) {
    console.error(`FAIL set image_url for ${item.name}: ${upd.error.message}`);
    continue;
  }
  uploaded++;
  console.log(`OK  ${entry.category} / ${item.name}  <-  ${entry.file}`);
}

const itemsWithoutImage = items
  .filter((it) => !it.image_url && !matched.has(it.id))
  .map((it) => `${it.categories?.name ?? "?"} / ${it.name}`);

console.log("\n──────── SUMMARY ────────");
console.log(`manifest entries      : ${manifest.images.length}`);
console.log(`uploaded (+url set)   : ${uploaded}`);
console.log(`skipped (had url)     : ${skipped}`);
console.log(`manifest file missing : ${missingFile.length ? missingFile.join(", ") : "none"}`);
console.log(`manifest w/o DB dish  : ${noDbItem.length ? noDbItem.join(", ") : "none"}`);
console.log(`DB dishes w/o image   : ${itemsWithoutImage.length ? itemsWithoutImage.join(", ") : "none"}`);
