-- =========================================================================
-- JAGGER — configuration par tenant.
-- À exécuter APRÈS 01_schema.sql, AVANT 03_seed_menu.sql.
--
-- ⚠️  Remplacez d'abord __REPLACE_WITH_UNIQUE_PUSH_SECRET__ ci-dessous par un
--     secret ALÉATOIRE et PROPRE à ce projet (différent de celui de BOX ou de
--     tout autre client). Ce fichier ne doit JAMAIS être versionné avec la
--     vraie valeur.
--
--     Générer un secret :  openssl rand -base64 32
--
--     La même valeur doit être posée en secret d'Edge Function sous le nom
--     PUSH_TRIGGER_SECRET (voir supabase/bootstrap/README.md) : les triggers
--     l'envoient dans l'en-tête `x-push-secret` et chaque fonction la vérifie.
-- =========================================================================

-- Secret partagé triggers ↔ Edge Functions.
insert into public.internal_config (key, value)
values ('push_trigger_secret', '__REPLACE_WITH_UNIQUE_PUSH_SECRET__')
on conflict (key) do update set value = excluded.value;

-- Temps de préparation affiché au client et utilisé pour calculer l'heure
-- d'arrivée estimée (set_order_arrival_at). La carte annonce 15–20 min : on
-- retient la borne haute pour ne pas promettre une arrivée trop optimiste.
insert into public.app_settings (id, prep_time_minutes)
values (1, 20)
on conflict (id) do update set prep_time_minutes = excluded.prep_time_minutes;

-- Rappel — la zone de livraison (36.85607405239656 / 10.15702900042228, 7 km)
-- est codée dans public.enforce_delivery_zone() (01_schema.sql) et DOIT rester
-- identique à src/lib/geo.ts. Le test src/lib/geo.test.ts garde les deux
-- alignés ; vérifier après tout changement :
--   select round((6371 * 2 * asin(sqrt(
--            sin(radians(36.80 - 36.85607405239656) / 2) ^ 2
--            + cos(radians(36.85607405239656)) * cos(radians(36.80))
--              * sin(radians(10.18 - 10.15702900042228) / 2) ^ 2
--          )))::numeric, 12);
