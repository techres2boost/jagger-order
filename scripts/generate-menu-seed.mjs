#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Génère, à partir de la SEULE source de vérité `src/data/menu.ts` :
//   * supabase/bootstrap/03_seed_menu.sql — catégories, plats, prix
//     (menu_item_sizes), flags "featured", groupes d'options et rattachements ;
//   * menu/manifest.json — appairage exact fichier image ↔ (catégorie, plat),
//     consommé par scripts/upload-menu-images.mjs.
//
// Pourquoi un manifeste plutôt qu'un appariement par nom normalisé : plusieurs
// fichiers ne portent pas le nom exact du plat (« tanino.png » → TONINO,
// « fondant au choxolat.png » → Fondant au Chocolat…) et deux plats homonymes
// existent dans des catégories différentes (« Detox », « Overdose »), ce qui
// rendrait l'appariement global ambigu.
//
// USAGE
//   node scripts/generate-menu-seed.mjs
// ---------------------------------------------------------------------------
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = join(root, "node_modules", ".cache", "jagger-menu");
mkdirSync(tmpDir, { recursive: true });

// `src/data/menu.ts` est du TypeScript : on le transpile en ESM avant import.
const compiled = join(tmpDir, "menu.mjs");
await build({
  entryPoints: [join(root, "src/data/menu.ts")],
  outfile: compiled,
  format: "esm",
  bundle: false,
  logLevel: "silent",
});
const { CATEGORIES, MENU, OPTION_GROUPS } = await import(pathToFileURL(compiled).href);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const nullable = (s) => (s == null || s === "" ? "null" : q(s));

// ─── Contrôles de cohérence ────────────────────────────────────────────────
const problems = [];
const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
const seen = new Set();
for (const d of MENU) {
  if (!bySlug.has(d.category)) problems.push(`catégorie inconnue « ${d.category} » pour « ${d.name} »`);
  const dup = `${d.category}/${d.name.trim().toLowerCase()}`;
  if (seen.has(dup)) problems.push(`doublon nom+catégorie : ${dup}`);
  seen.add(dup);
  if (!(d.price > 0)) problems.push(`prix invalide pour « ${d.name} »`);
  if (d.image && !existsSync(join(root, "menu", d.image))) {
    problems.push(`image absente du dépôt : menu/${d.image} (plat « ${d.name} »)`);
  }
  for (const key of d.options ?? []) {
    if (!OPTION_GROUPS.some((g) => g.key === key)) {
      problems.push(`groupe d'options inconnu « ${key} » pour « ${d.name} »`);
    }
  }
}
if (problems.length) {
  console.error("ERREURS :\n  - " + problems.join("\n  - "));
  process.exit(1);
}

// ─── 03_seed_menu.sql ──────────────────────────────────────────────────────
const lines = [];
lines.push(`-- =========================================================================`);
lines.push(`-- JAGGER — seed du menu. GÉNÉRÉ : ne pas éditer à la main.`);
lines.push(`-- Source : src/data/menu.ts — régénérer avec :`);
lines.push(`--   node scripts/generate-menu-seed.mjs`);
lines.push(`--`);
lines.push(`-- Les prix sont insérés dans menu_item_sizes (jamais sur menu_items),`);
lines.push(`-- en dinars décimaux, avec le libellé de format « Standard » : chaque plat`);
lines.push(`-- de la carte Jagger a un prix unique.`);
lines.push(`-- Idempotent : ré-exécutable, les plats existants sont mis à jour.`);
lines.push(`-- Les images ne sont PAS posées ici (voir scripts/upload-menu-images.mjs).`);
lines.push(`-- =========================================================================`);
lines.push("");
lines.push("begin;");
lines.push("");

lines.push("-- ─── Catégories ──────────────────────────────────────────────────────────");
CATEGORIES.forEach((c, i) => {
  lines.push(
    `insert into public.categories (name, display_order) values (${q(c.name)}, ${i + 1})\n` +
      `  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;`,
  );
});
lines.push("");

lines.push("-- ─── Groupes d'options ───────────────────────────────────────────────────");
OPTION_GROUPS.forEach((g, gi) => {
  lines.push(
    `insert into public.option_groups (name, type, max_selection, display_order)\n` +
      `  select ${q(g.name)}, ${q(g.type)}, ${g.maxSelection}, ${gi + 1}\n` +
      `  where not exists (select 1 from public.option_groups where name = ${q(g.name)});`,
  );
  g.items.forEach((it, ii) => {
    lines.push(
      `insert into public.option_items (group_id, name, price, display_order)\n` +
        `  select og.id, ${q(it.name)}, ${it.price.toFixed(3)}, ${ii + 1}\n` +
        `  from public.option_groups og where og.name = ${q(g.name)}\n` +
        `    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = ${q(it.name)});`,
    );
  });
});
lines.push("");

lines.push("-- ─── Plats, prix et options ──────────────────────────────────────────────");
let order = 0;
let currentCategory = null;
for (const d of MENU) {
  if (d.category !== currentCategory) {
    currentCategory = d.category;
    order = 0;
    lines.push("");
    lines.push(`-- ${bySlug.get(d.category).name}`);
  }
  order += 1;
  const cat = bySlug.get(d.category).name;
  lines.push(
    `insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)\n` +
      `  select c.id, ${q(d.name)}, ${nullable(d.description)}, ${order}, ${d.featured ? "true" : "false"}, true\n` +
      `  from public.categories c where lower(trim(c.name)) = lower(trim(${q(cat)}))\n` +
      `  on conflict (category_id, lower(trim(name))) do update\n` +
      `    set description = excluded.description,\n` +
      `        display_order = excluded.display_order,\n` +
      `        is_featured = excluded.is_featured,\n` +
      `        updated_at = now();`,
  );
  lines.push(
    `insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)\n` +
      `  select mi.id, 'Standard', ${d.price.toFixed(3)}, 1\n` +
      `  from public.menu_items mi join public.categories c on c.id = mi.category_id\n` +
      `  where lower(trim(mi.name)) = lower(trim(${q(d.name)})) and lower(trim(c.name)) = lower(trim(${q(cat)}))\n` +
      `    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');`,
  );
  lines.push(
    `update public.menu_item_sizes s set price = ${d.price.toFixed(3)}\n` +
      `  from public.menu_items mi join public.categories c on c.id = mi.category_id\n` +
      `  where s.menu_item_id = mi.id and s.size_label = 'Standard'\n` +
      `    and lower(trim(mi.name)) = lower(trim(${q(d.name)})) and lower(trim(c.name)) = lower(trim(${q(cat)}));`,
  );
  for (const key of d.options ?? []) {
    const g = OPTION_GROUPS.find((x) => x.key === key);
    lines.push(
      `insert into public.menu_item_option_groups (menu_item_id, option_group_id, display_order)\n` +
        `  select mi.id, og.id, 1\n` +
        `  from public.menu_items mi join public.categories c on c.id = mi.category_id,\n` +
        `       public.option_groups og\n` +
        `  where lower(trim(mi.name)) = lower(trim(${q(d.name)})) and lower(trim(c.name)) = lower(trim(${q(cat)}))\n` +
        `    and og.name = ${q(g.name)}\n` +
        `  on conflict (menu_item_id, option_group_id) do nothing;`,
    );
  }
}
lines.push("");
lines.push("commit;");
lines.push("");

const seedPath = join(root, "supabase/bootstrap/03_seed_menu.sql");
mkdirSync(dirname(seedPath), { recursive: true });
writeFileSync(seedPath, lines.join("\n"), "utf8");

// ─── menu/manifest.json ────────────────────────────────────────────────────
const manifest = MENU.filter((d) => d.image).map((d) => ({
  file: d.image,
  category: bySlug.get(d.category).name,
  dish: d.name,
}));
writeFileSync(
  join(root, "menu/manifest.json"),
  JSON.stringify({ generated_by: "scripts/generate-menu-seed.mjs", images: manifest }, null, 2) + "\n",
  "utf8",
);

const withoutImage = MENU.filter((d) => !d.image);
console.log(`catégories        : ${CATEGORIES.length}`);
console.log(`plats             : ${MENU.length}`);
console.log(`plats "featured"  : ${MENU.filter((d) => d.featured).length}`);
console.log(`groupes d'options : ${OPTION_GROUPS.length} (${OPTION_GROUPS.reduce((n, g) => n + g.items.length, 0)} choix)`);
console.log(`images appairées  : ${manifest.length}`);
console.log(
  `plats sans image  : ${withoutImage.length ? withoutImage.map((d) => d.name).join(", ") : "aucun"}`,
);
console.log(`\nécrit : supabase/bootstrap/03_seed_menu.sql, menu/manifest.json`);
