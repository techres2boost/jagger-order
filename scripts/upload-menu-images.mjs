#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Uploads the local menu/ images to the Supabase `dish-images` bucket and sets
// each menu_items.image_url to the resulting public URL.
//
// WHY THIS SCRIPT EXISTS
// The categories, menu_items, prices (menu_item_sizes), featured flags and
// options/supplements were seeded directly in the database. Only the image
// bytes remain: they cannot be uploaded from the automation sandbox because its
// egress policy blocks *.supabase.co (and storage.objects cannot be mutated via
// SQL — a trigger forbids it). Run this once from a machine with normal network
// access.
//
// USAGE
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   node scripts/upload-menu-images.mjs [--menu ./menu] [--force] [--reset-bucket]
//
// - SUPABASE_URL defaults to the project URL below if unset.
// - The SERVICE ROLE key is required: uploading to dish-images is admin-only
//   (RLS), and the service role bypasses RLS. Keep it secret; never commit it.
// - Matching is by dish NAME, normalised (lowercase, accents stripped,
//   hyphens -> spaces). Filenames have no accents; DB names do — that's fine.
// - Idempotent: items that already have an image_url are skipped unless --force.
// - --reset-bucket : delete ALL existing objects in dish-images first (use it
//   once, after a full menu re-seed, to clear images tied to old dish IDs).
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "dish-images";
const DEFAULT_URL = "https://ssmmstetcmgsjnjbjkat.supabase.co";

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

const CONTENT_TYPE = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

// Same normalisation the DB seed used to pair images with dishes.
const norm = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/-/g, " ")
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

// Collect local image files across every sub-folder of menu/.
const files = [];
for (const entry of readdirSync(menuDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(menuDir, entry.name);
  for (const f of readdirSync(dir)) {
    const ext = extname(f).slice(1).toLowerCase();
    if (!CONTENT_TYPE[ext]) continue;
    files.push({ path: join(dir, f), key: norm(basename(f, extname(f))), ext });
  }
}

const { data: items, error } = await supabase
  .from("menu_items")
  .select("id, name, image_url");
if (error) {
  console.error("ERROR fetching menu_items:", error.message);
  process.exit(1);
}

// Build a normalised-name -> item index, flagging DB-side collisions.
const byName = new Map();
for (const it of items) {
  const k = norm(it.name);
  if (byName.has(k)) byName.set(k, "AMBIGUOUS");
  else byName.set(k, it);
}

let uploaded = 0,
  skipped = 0;
const imgNoItem = [];
const ambiguous = [];

for (const file of files) {
  const match = byName.get(file.key);
  if (!match) {
    imgNoItem.push(file.path);
    continue;
  }
  if (match === "AMBIGUOUS") {
    ambiguous.push(file.path);
    continue;
  }
  if (match.image_url && !force) {
    skipped++;
    continue;
  }
  const bytes = readFileSync(file.path);
  const objectPath = `${match.id}-${Date.now()}.${file.ext}`;
  const up = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: CONTENT_TYPE[file.ext],
    cacheControl: "31536000",
    upsert: true,
  });
  if (up.error) {
    console.error(`FAIL upload ${file.path}: ${up.error.message}`);
    continue;
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const upd = await supabase.from("menu_items").update({ image_url: publicUrl }).eq("id", match.id);
  if (upd.error) {
    console.error(`FAIL set image_url for ${match.name}: ${upd.error.message}`);
    continue;
  }
  uploaded++;
  console.log(`OK  ${match.name}  <-  ${file.path}`);
}

const itemsWithoutImage = items
  .filter((it) => !it.image_url && !files.some((f) => byName.get(f.key) === it))
  .map((it) => it.name);

console.log("\n──────── SUMMARY ────────");
console.log(`local images       : ${files.length}`);
console.log(`uploaded (+url set) : ${uploaded}`);
console.log(`skipped (had url)   : ${skipped}`);
console.log(`images w/o DB item  : ${imgNoItem.length ? imgNoItem.join(", ") : "none"}`);
console.log(`ambiguous matches   : ${ambiguous.length ? ambiguous.join(", ") : "none"}`);
console.log(`DB items w/o image  : ${itemsWithoutImage.length ? itemsWithoutImage.join(", ") : "none"}`);
