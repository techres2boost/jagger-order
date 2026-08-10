-- =========================================================================
-- JAGGER — seed du menu. GÉNÉRÉ : ne pas éditer à la main.
-- Source : src/data/menu.ts — régénérer avec :
--   node scripts/generate-menu-seed.mjs
--
-- Les prix sont insérés dans menu_item_sizes (jamais sur menu_items),
-- en dinars décimaux, avec le libellé de format « Standard » : chaque plat
-- de la carte Jagger a un prix unique.
-- Idempotent : ré-exécutable, les plats existants sont mis à jour.
-- Les images ne sont PAS posées ici (voir scripts/upload-menu-images.mjs).
-- =========================================================================

begin;

-- ─── Catégories ──────────────────────────────────────────────────────────
insert into public.categories (name, display_order) values ('Cafés', 1)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Signatures', 2)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Thés', 3)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Jus frais', 4)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Cocktails', 5)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Mojitos', 6)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Milkshakes', 7)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Frappuccinos', 8)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Chocolats', 9)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Smoothie bowls', 10)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Desserts', 11)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Crêpes sucrées', 12)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Crêpes salées', 13)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Gaufres sucrées', 14)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Gaufres salées', 15)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Pancakes', 16)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Sandwichs', 17)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Salades', 18)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Pasta', 19)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Plats', 20)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Chichas', 21)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;
insert into public.categories (name, display_order) values ('Boissons', 22)
  on conflict (lower(trim(name))) do update set display_order = excluded.display_order;

-- ─── Groupes d'options ───────────────────────────────────────────────────
insert into public.option_groups (name, type, max_selection, display_order)
  select 'Parfum', 'retirable', 1, 1
  where not exists (select 1 from public.option_groups where name = 'Parfum');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Pomme', 0.000, 1
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Pomme');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Menthe', 0.000, 2
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Menthe');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Raisin', 0.000, 3
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Raisin');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Pêche', 0.000, 4
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Pêche');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Cerise', 0.000, 5
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Cerise');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Chewing-Gum', 0.000, 6
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Chewing-Gum');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Pastèque', 0.000, 7
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Pastèque');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Citron', 0.000, 8
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Citron');
insert into public.option_items (group_id, name, price, display_order)
  select og.id, 'Mojito', 0.000, 9
  from public.option_groups og where og.name = 'Parfum'
    and not exists (select 1 from public.option_items oi where oi.group_id = og.id and oi.name = 'Mojito');

-- ─── Plats, prix et options ──────────────────────────────────────────────

-- Cafés
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Espresso', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 4.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Espresso')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 4.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Espresso')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Espresso Nespresso', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 6.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Espresso Nespresso')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 6.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Espresso Nespresso')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Macchiato', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 5.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Macchiato')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 5.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Macchiato')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Macchiato Nespresso', null, 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Macchiato Nespresso')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Macchiato Nespresso')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Cappuccino Crème', null, 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 5.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Cappuccino Crème')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 5.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Cappuccino Crème')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Café Crème Nespresso', null, 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Café Crème Nespresso')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Café Crème Nespresso')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Espresso Americano', null, 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 5.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Espresso Americano')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 5.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Espresso Americano')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Café Turc', null, 8, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Café Turc')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Café Turc')) and lower(trim(c.name)) = lower(trim('Cafés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Nescafé au Lait', null, 9, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cafés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Nescafé au Lait')) and lower(trim(c.name)) = lower(trim('Cafés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Nescafé au Lait')) and lower(trim(c.name)) = lower(trim('Cafés'));

-- Signatures
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Café Brownies', null, 1, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Signatures'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Café Brownies')) and lower(trim(c.name)) = lower(trim('Signatures'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Café Brownies')) and lower(trim(c.name)) = lower(trim('Signatures'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Café Cookies', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Signatures'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Café Cookies')) and lower(trim(c.name)) = lower(trim('Signatures'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Café Cookies')) and lower(trim(c.name)) = lower(trim('Signatures'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Café Chocolat', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Signatures'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Café Chocolat')) and lower(trim(c.name)) = lower(trim('Signatures'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Café Chocolat')) and lower(trim(c.name)) = lower(trim('Signatures'));

-- Thés
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Thé Tunisien à la Menthe', 'avec petits biscuits', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Thés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 4.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Thé Tunisien à la Menthe')) and lower(trim(c.name)) = lower(trim('Thés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 4.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Thé Tunisien à la Menthe')) and lower(trim(c.name)) = lower(trim('Thés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Thé aux Amandes', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Thés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 6.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Thé aux Amandes')) and lower(trim(c.name)) = lower(trim('Thés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 6.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Thé aux Amandes')) and lower(trim(c.name)) = lower(trim('Thés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Thé Infusion au Choix', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Thés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 6.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Thé Infusion au Choix')) and lower(trim(c.name)) = lower(trim('Thés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 6.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Thé Infusion au Choix')) and lower(trim(c.name)) = lower(trim('Thés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Thé aux Pignons', null, 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Thés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Thé aux Pignons')) and lower(trim(c.name)) = lower(trim('Thés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Thé aux Pignons')) and lower(trim(c.name)) = lower(trim('Thés'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Thé aux Fruits Secs', 'amandes, noix, noisettes', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Thés'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 11.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Thé aux Fruits Secs')) and lower(trim(c.name)) = lower(trim('Thés'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 11.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Thé aux Fruits Secs')) and lower(trim(c.name)) = lower(trim('Thés'));

-- Jus frais
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Citronnade', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 6.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Citronnade')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 6.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Citronnade')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jus d''Orange', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 6.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jus d''Orange')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 6.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jus d''Orange')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jus de Fraise', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jus de Fraise')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jus de Fraise')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jus de Pomme', null, 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jus de Pomme')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jus de Pomme')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jus de Pêche', null, 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 7.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jus de Pêche')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 7.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jus de Pêche')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Citronnade aux Amandes', null, 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 8.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Citronnade aux Amandes')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 8.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Citronnade aux Amandes')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Lait de Poule', null, 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 8.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Lait de Poule')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 8.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Lait de Poule')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jus d''Ananas', null, 8, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jus d''Ananas')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jus d''Ananas')) and lower(trim(c.name)) = lower(trim('Jus frais'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jus de Kiwi', null, 9, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Jus frais'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jus de Kiwi')) and lower(trim(c.name)) = lower(trim('Jus frais'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jus de Kiwi')) and lower(trim(c.name)) = lower(trim('Jus frais'));

-- Cocktails
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Ice Berg', 'sorbet citron, citronnade, framboise, menthe', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Ice Berg')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Ice Berg')) and lower(trim(c.name)) = lower(trim('Cocktails'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Slushy', 'fraise, kiwi, banane, orange', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 11.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Slushy')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 11.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Slushy')) and lower(trim(c.name)) = lower(trim('Cocktails'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Pina Colada', 'ananas, noix de coco', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 11.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Pina Colada')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 11.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Pina Colada')) and lower(trim(c.name)) = lower(trim('Cocktails'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Red Moon', 'fraise, banane, cassis, glace vanille', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Red Moon')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Red Moon')) and lower(trim(c.name)) = lower(trim('Cocktails'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Detox', 'kiwi, pomme, épinard, citron', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Detox')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Detox')) and lower(trim(c.name)) = lower(trim('Cocktails'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Blue Breeze', 'ananas, mangue, curaçao bleu, noix de coco', 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Blue Breeze')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Blue Breeze')) and lower(trim(c.name)) = lower(trim('Cocktails'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Energy Power', 'ananas, kiwi, menthe, basilic', 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Cocktails'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Energy Power')) and lower(trim(c.name)) = lower(trim('Cocktails'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Energy Power')) and lower(trim(c.name)) = lower(trim('Cocktails'));

-- Mojitos
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Mojito Classique', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Mojito Classique')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Mojito Classique')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Mojito Fraise', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Mojito Fraise')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Mojito Fraise')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Mojito Myrtilles', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Mojito Myrtilles')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Mojito Myrtilles')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Mojito Pomme', null, 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Mojito Pomme')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Mojito Pomme')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Mojito Rose', null, 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Mojito Rose')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Mojito Rose')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Passion', 'fruits de la passion', 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 11.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Passion')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 11.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Passion')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Detox', 'menthe, citron, concombre, gingembre', 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 11.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Detox')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 11.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Detox')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Big Power Redbull', null, 8, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Big Power Redbull')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Big Power Redbull')) and lower(trim(c.name)) = lower(trim('Mojitos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Big Boss', 'pour 4 personnes', 9, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Mojitos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 38.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Big Boss')) and lower(trim(c.name)) = lower(trim('Mojitos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 38.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Big Boss')) and lower(trim(c.name)) = lower(trim('Mojitos'));

-- Milkshakes
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Chocolat / Vanille / Fraise', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Milkshakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Chocolat / Vanille / Fraise')) and lower(trim(c.name)) = lower(trim('Milkshakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Chocolat / Vanille / Fraise')) and lower(trim(c.name)) = lower(trim('Milkshakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Oreo / Nutella / Speculoos', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Milkshakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Oreo / Nutella / Speculoos')) and lower(trim(c.name)) = lower(trim('Milkshakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Oreo / Nutella / Speculoos')) and lower(trim(c.name)) = lower(trim('Milkshakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Mars', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Milkshakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Mars')) and lower(trim(c.name)) = lower(trim('Milkshakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Mars')) and lower(trim(c.name)) = lower(trim('Milkshakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Kinder', null, 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Milkshakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Kinder')) and lower(trim(c.name)) = lower(trim('Milkshakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Kinder')) and lower(trim(c.name)) = lower(trim('Milkshakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Ferrero Rocher', null, 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Milkshakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Ferrero Rocher')) and lower(trim(c.name)) = lower(trim('Milkshakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Ferrero Rocher')) and lower(trim(c.name)) = lower(trim('Milkshakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Big Choc', 'Oreo, Nutella, Kinder, M&M''s', 6, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Milkshakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Big Choc')) and lower(trim(c.name)) = lower(trim('Milkshakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Big Choc')) and lower(trim(c.name)) = lower(trim('Milkshakes'));

-- Frappuccinos
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Caramel / Noisettes', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Frappuccinos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Caramel / Noisettes')) and lower(trim(c.name)) = lower(trim('Frappuccinos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Caramel / Noisettes')) and lower(trim(c.name)) = lower(trim('Frappuccinos'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Nutella / Spéculoos', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Frappuccinos'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Nutella / Spéculoos')) and lower(trim(c.name)) = lower(trim('Frappuccinos'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Nutella / Spéculoos')) and lower(trim(c.name)) = lower(trim('Frappuccinos'));

-- Chocolats
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Chocolat Chaud / Cold Chocolate', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Chocolats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Chocolat Chaud / Cold Chocolate')) and lower(trim(c.name)) = lower(trim('Chocolats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Chocolat Chaud / Cold Chocolate')) and lower(trim(c.name)) = lower(trim('Chocolats'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Chocolat Chaud Caramel / Oreo / Speculoos', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Chocolats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Chocolat Chaud Caramel / Oreo / Speculoos')) and lower(trim(c.name)) = lower(trim('Chocolats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Chocolat Chaud Caramel / Oreo / Speculoos')) and lower(trim(c.name)) = lower(trim('Chocolats'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'ChoSec', 'amandes et noisettes concassées', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Chocolats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('ChoSec')) and lower(trim(c.name)) = lower(trim('Chocolats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('ChoSec')) and lower(trim(c.name)) = lower(trim('Chocolats'));

-- Smoothie bowls
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Green', 'pomme, kiwi, avoine, graines', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Smoothie bowls'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Green')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Green')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Red', 'framboise, cassis, fraise, avoine', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Smoothie bowls'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Red')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Red')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Brown', 'banane, dattes, beurre de cacahuète, chocolat', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Smoothie bowls'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Brown')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Brown')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Jwejem', 'yaourt glacé nature', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Smoothie bowls'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Jwejem')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Jwejem')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Warrior', 'yaourt + fruits séchés, frais, avoine', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Smoothie bowls'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Warrior')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Warrior')) and lower(trim(c.name)) = lower(trim('Smoothie bowls'));

-- Desserts
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Fondant au Chocolat', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Fondant au Chocolat')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Fondant au Chocolat')) and lower(trim(c.name)) = lower(trim('Desserts'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Tiramisu', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Tiramisu')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Tiramisu')) and lower(trim(c.name)) = lower(trim('Desserts'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Knefa', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Knefa')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Knefa')) and lower(trim(c.name)) = lower(trim('Desserts'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Assiette de Fruits de Saison', 'pour 2', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Assiette de Fruits de Saison')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Assiette de Fruits de Saison')) and lower(trim(c.name)) = lower(trim('Desserts'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Glace 2 Boules', null, 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Glace 2 Boules')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Glace 2 Boules')) and lower(trim(c.name)) = lower(trim('Desserts'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Glace 3 Boules avec fruits secs', null, 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Glace 3 Boules avec fruits secs')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Glace 3 Boules avec fruits secs')) and lower(trim(c.name)) = lower(trim('Desserts'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Banana Split', null, 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Desserts'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Banana Split')) and lower(trim(c.name)) = lower(trim('Desserts'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Banana Split')) and lower(trim(c.name)) = lower(trim('Desserts'));

-- Crêpes sucrées
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'PICK ME UP', 'Nutella, fruits', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('PICK ME UP')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('PICK ME UP')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'OUT OF AFRICA', 'caramel, noisettes', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('OUT OF AFRICA')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('OUT OF AFRICA')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'UP-TODATE', 'fruits rouges, crème', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('UP-TODATE')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('UP-TODATE')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Biscoff', 'biscoff, banane', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Biscoff')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Biscoff')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'TRI-SHOT', 'Nutella, banane, chocolat', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('TRI-SHOT')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('TRI-SHOT')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'BLACK JAGGER', 'Jagermeister, banane', 6, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('BLACK JAGGER')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('BLACK JAGGER')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'PUMP IT UP', 'Nutella, banane', 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('PUMP IT UP')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('PUMP IT UP')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'DOLCEZZZA BIANCA', 'mascarpone, fruits', 8, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('DOLCEZZZA BIANCA')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('DOLCEZZZA BIANCA')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'OVERDOSE', 'Nutella, banane, crème', 9, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 16.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('OVERDOSE')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 16.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('OVERDOSE')) and lower(trim(c.name)) = lower(trim('Crêpes sucrées'));

-- Crêpes salées
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'TONINO', 'fromage, tomate', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('TONINO')) and lower(trim(c.name)) = lower(trim('Crêpes salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('TONINO')) and lower(trim(c.name)) = lower(trim('Crêpes salées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'TI-PUNCH', 'poulet, sauce barbecue', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('TI-PUNCH')) and lower(trim(c.name)) = lower(trim('Crêpes salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('TI-PUNCH')) and lower(trim(c.name)) = lower(trim('Crêpes salées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'CARAMBA', 'fromage, spéculoos', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('CARAMBA')) and lower(trim(c.name)) = lower(trim('Crêpes salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('CARAMBA')) and lower(trim(c.name)) = lower(trim('Crêpes salées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'MEXICAINE', 'poulet, épices mexicaines', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('MEXICAINE')) and lower(trim(c.name)) = lower(trim('Crêpes salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('MEXICAINE')) and lower(trim(c.name)) = lower(trim('Crêpes salées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'MOSKOVA', 'fromage, crème, légumes', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Crêpes salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 18.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('MOSKOVA')) and lower(trim(c.name)) = lower(trim('Crêpes salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 18.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('MOSKOVA')) and lower(trim(c.name)) = lower(trim('Crêpes salées'));

-- Gaufres sucrées
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Lovely', 'Nutella, pépites chocolat', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 11.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Lovely')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 11.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Lovely')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'So-Sec', 'Nutella, fruits secs', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('So-Sec')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('So-Sec')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Tofifee', 'caramel, banane, noisettes', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Tofifee')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Tofifee')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Boreo', 'Nutella, banane, Oreo', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Boreo')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Boreo')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Paradice', 'chocolat blanc, fruits rouges', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Paradice')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Paradice')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Overdose', 'Nutella, Oreo, choc blanc, Kinder, Mars, 2 boules glace', 6, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 17.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Overdose')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 17.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Overdose')) and lower(trim(c.name)) = lower(trim('Gaufres sucrées'));

-- Gaufres salées
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Chicken', 'poulet pané, fromage, roquette, légumes confits', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Chicken')) and lower(trim(c.name)) = lower(trim('Gaufres salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Chicken')) and lower(trim(c.name)) = lower(trim('Gaufres salées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Gaufre 3 Fromages', 'mozzarella, gorgonzola, raclette, noix, abricots', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 16.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Gaufre 3 Fromages')) and lower(trim(c.name)) = lower(trim('Gaufres salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 16.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Gaufre 3 Fromages')) and lower(trim(c.name)) = lower(trim('Gaufres salées'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Guido''s', 'bresaola, gouda, champignons, roquette', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Gaufres salées'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 17.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Guido''s')) and lower(trim(c.name)) = lower(trim('Gaufres salées'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 17.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Guido''s')) and lower(trim(c.name)) = lower(trim('Gaufres salées'));

-- Pancakes
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Banoffee Classique', 'caramel, banane, noix', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pancakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Banoffee Classique')) and lower(trim(c.name)) = lower(trim('Pancakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Banoffee Classique')) and lower(trim(c.name)) = lower(trim('Pancakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Banoffee Cremosa', 'caramel, banane, noix + mascarpone', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pancakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Banoffee Cremosa')) and lower(trim(c.name)) = lower(trim('Pancakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Banoffee Cremosa')) and lower(trim(c.name)) = lower(trim('Pancakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'The Berry One Classique', 'Nutella, Oreo, fruits rouges', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pancakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('The Berry One Classique')) and lower(trim(c.name)) = lower(trim('Pancakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('The Berry One Classique')) and lower(trim(c.name)) = lower(trim('Pancakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'The Berry One Cremosa', 'Nutella, Oreo, fruits rouges + mascarpone', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pancakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 17.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('The Berry One Cremosa')) and lower(trim(c.name)) = lower(trim('Pancakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 17.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('The Berry One Cremosa')) and lower(trim(c.name)) = lower(trim('Pancakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Frutti Classique', 'Nutella, fraise, banane, kiwi', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pancakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Frutti Classique')) and lower(trim(c.name)) = lower(trim('Pancakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Frutti Classique')) and lower(trim(c.name)) = lower(trim('Pancakes'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Frutti Cremosa', 'Nutella, fraise, banane, kiwi + mascarpone', 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pancakes'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 16.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Frutti Cremosa')) and lower(trim(c.name)) = lower(trim('Pancakes'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 16.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Frutti Cremosa')) and lower(trim(c.name)) = lower(trim('Pancakes'));

-- Sandwichs
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Me So HUngrI', 'escalope grillée, mozzarella, gouda, roquette – servi avec frites', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Sandwichs'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 12.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Me So HUngrI')) and lower(trim(c.name)) = lower(trim('Sandwichs'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 12.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Me So HUngrI')) and lower(trim(c.name)) = lower(trim('Sandwichs'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Kaporal', 'escalope panée, mozzarella, jambon, amandes', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Sandwichs'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 13.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Kaporal')) and lower(trim(c.name)) = lower(trim('Sandwichs'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 13.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Kaporal')) and lower(trim(c.name)) = lower(trim('Sandwichs'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Pacific', 'dinde mexicaine, mozzarella, bacon', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Sandwichs'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 14.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Pacific')) and lower(trim(c.name)) = lower(trim('Sandwichs'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 14.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Pacific')) and lower(trim(c.name)) = lower(trim('Sandwichs'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'B52', 'viande hachée, mozzarella, pepperoni, gouda, noisettes', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Sandwichs'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('B52')) and lower(trim(c.name)) = lower(trim('Sandwichs'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('B52')) and lower(trim(c.name)) = lower(trim('Sandwichs'));

-- Salades
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Salade Fraîcheur', 'laitue, thon, légumes, œuf dur', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Salades'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 15.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Salade Fraîcheur')) and lower(trim(c.name)) = lower(trim('Salades'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 15.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Salade Fraîcheur')) and lower(trim(c.name)) = lower(trim('Salades'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Salade César', 'poulet pané, parmesan, tomates cerises, noix', 2, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Salades'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 18.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Salade César')) and lower(trim(c.name)) = lower(trim('Salades'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 18.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Salade César')) and lower(trim(c.name)) = lower(trim('Salades'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Camembert Chaud', 'toasts, oignons caramélisés, figues, miel', 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Salades'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 22.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Camembert Chaud')) and lower(trim(c.name)) = lower(trim('Salades'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 22.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Camembert Chaud')) and lower(trim(c.name)) = lower(trim('Salades'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Salade Exotique', 'bresaola, avocat, kiwi, pommes, noix', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Salades'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 23.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Salade Exotique')) and lower(trim(c.name)) = lower(trim('Salades'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 23.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Salade Exotique')) and lower(trim(c.name)) = lower(trim('Salades'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Burrata Bresaola', 'roquette, figues séchées, crème balsamique', 5, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Salades'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 25.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Burrata Bresaola')) and lower(trim(c.name)) = lower(trim('Salades'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 25.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Burrata Bresaola')) and lower(trim(c.name)) = lower(trim('Salades'));

-- Pasta
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Puttanesca', 'spaghetti/penne, thon, olives, câpres', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 18.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Puttanesca')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 18.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Puttanesca')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Spaghetti aux Boulettes', 'parmesan', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 20.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Spaghetti aux Boulettes')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 20.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Spaghetti aux Boulettes')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Penne Poulet Pané', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 23.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Penne Poulet Pané')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 23.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Penne Poulet Pané')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Tagliatelles con Pollo e Spinacci', 'sauce blanche ou épinards', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 24.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Tagliatelles con Pollo e Spinacci')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 24.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Tagliatelles con Pollo e Spinacci')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Lasagne alla Bolognese', null, 5, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 25.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Lasagne alla Bolognese')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 25.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Lasagne alla Bolognese')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Penne Mare e Monti', 'crevettes, champignons', 6, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 28.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Penne Mare e Monti')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 28.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Penne Mare e Monti')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Penne Pesto et Crevettes', null, 7, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 30.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Penne Pesto et Crevettes')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 30.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Penne Pesto et Crevettes')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Spaghettis al Frutti di Mare', null, 8, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 33.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Spaghettis al Frutti di Mare')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 33.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Spaghettis al Frutti di Mare')) and lower(trim(c.name)) = lower(trim('Pasta'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Paella', 'pour 1 personne', 9, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Pasta'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 37.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Paella')) and lower(trim(c.name)) = lower(trim('Pasta'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 37.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Paella')) and lower(trim(c.name)) = lower(trim('Pasta'));

-- Plats
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Xango', 'cordon bleu / poulet grillé, riz, salade, potatoes', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Plats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 22.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Xango')) and lower(trim(c.name)) = lower(trim('Plats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 22.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Xango')) and lower(trim(c.name)) = lower(trim('Plats'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Orchidée', 'suprême poulet, sauce champignons ou curry, riz', 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Plats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 24.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Orchidée')) and lower(trim(c.name)) = lower(trim('Plats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 24.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Orchidée')) and lower(trim(c.name)) = lower(trim('Plats'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Cordon Bleu', 'riz, salade, potatoes', 3, true, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Plats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 25.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Cordon Bleu')) and lower(trim(c.name)) = lower(trim('Plats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 25.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Cordon Bleu')) and lower(trim(c.name)) = lower(trim('Plats'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Côte à l''Os', 'pâtes sauce tomate, légumes sautés, potatoes', 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Plats'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 36.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Côte à l''Os')) and lower(trim(c.name)) = lower(trim('Plats'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 36.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Côte à l''Os')) and lower(trim(c.name)) = lower(trim('Plats'));

-- Chichas
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Chicha', 'Pomme, Menthe, Raisin, Pêche, Cerise, Chewing-Gum, Pastèque, Citron, Mojito', 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Chichas'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 9.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Chicha')) and lower(trim(c.name)) = lower(trim('Chichas'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 9.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Chicha')) and lower(trim(c.name)) = lower(trim('Chichas'));
insert into public.menu_item_option_groups (menu_item_id, option_group_id, display_order)
  select mi.id, og.id, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id,
       public.option_groups og
  where lower(trim(mi.name)) = lower(trim('Chicha')) and lower(trim(c.name)) = lower(trim('Chichas'))
    and og.name = 'Parfum'
  on conflict (menu_item_id, option_group_id) do nothing;

-- Boissons
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Eau Plate', null, 1, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Boissons'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 3.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Eau Plate')) and lower(trim(c.name)) = lower(trim('Boissons'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 3.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Eau Plate')) and lower(trim(c.name)) = lower(trim('Boissons'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Eau Gazeuse', null, 2, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Boissons'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 4.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Eau Gazeuse')) and lower(trim(c.name)) = lower(trim('Boissons'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 4.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Eau Gazeuse')) and lower(trim(c.name)) = lower(trim('Boissons'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Sodas', null, 3, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Boissons'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 4.500, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Sodas')) and lower(trim(c.name)) = lower(trim('Boissons'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 4.500
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Sodas')) and lower(trim(c.name)) = lower(trim('Boissons'));
insert into public.menu_items (category_id, name, description, display_order, is_featured, is_available)
  select c.id, 'Energy Drink', null, 4, false, true
  from public.categories c where lower(trim(c.name)) = lower(trim('Boissons'))
  on conflict (category_id, lower(trim(name))) do update
    set description = excluded.description,
        display_order = excluded.display_order,
        is_featured = excluded.is_featured,
        updated_at = now();
insert into public.menu_item_sizes (menu_item_id, size_label, price, display_order)
  select mi.id, 'Standard', 10.000, 1
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where lower(trim(mi.name)) = lower(trim('Energy Drink')) and lower(trim(c.name)) = lower(trim('Boissons'))
    and not exists (select 1 from public.menu_item_sizes s where s.menu_item_id = mi.id and s.size_label = 'Standard');
update public.menu_item_sizes s set price = 10.000
  from public.menu_items mi join public.categories c on c.id = mi.category_id
  where s.menu_item_id = mi.id and s.size_label = 'Standard'
    and lower(trim(mi.name)) = lower(trim('Energy Drink')) and lower(trim(c.name)) = lower(trim('Boissons'));

commit;
