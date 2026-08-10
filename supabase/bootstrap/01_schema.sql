-- ===========================================================================
-- JAGGER — bootstrap complet du backend Supabase
-- ---------------------------------------------------------------------------
-- Reproduit à l'identique le schéma de référence (projet BOX) sur le projet
-- Supabase VIERGE de Jagger. Généré depuis le schéma LIVE de référence
-- (pg_get_functiondef / pg_constraint / pg_policies / pg_indexes), pas depuis
-- les migrations du dépôt : celles-ci ne couvrent que 9 des 20 tables (le reste
-- a été créé via l'UI Lovable/Supabase).
--
-- SEULES différences volontaires avec la référence (valeurs par tenant) :
--   1. enforce_delivery_zone() : coordonnées du restaurant Jagger + rayon 7 km.
--   2. Les appels net.http_post() pointent vers le projet Jagger
--      (zouvaqadidzeieytanoa) et non vers celui de BOX.
--   3. internal_config.push_trigger_secret : valeur à renseigner à la main
--      (voir 02_seed_config.sql) — AUCUN secret n'est versionné.
--
-- ORDRE D'EXÉCUTION
--   01_schema.sql       (ce fichier)
--   02_seed_config.sql  (secret push + prep time + zone)
--   03_seed_menu.sql    (catégories, plats, prix, options)
--   puis : déployer les 6 Edge Functions, définir leurs secrets, et lancer
--   scripts/upload-menu-images.mjs pour les images (cf. README-menu-seed.md).
--
-- Idempotent : ré-exécutable sans erreur (IF NOT EXISTS / OR REPLACE / DROP
-- POLICY IF EXISTS).
-- ===========================================================================

-- ─── 1. Extensions ─────────────────────────────────────────────────────────
-- pg_net : OBLIGATOIRE — les triggers appellent les Edge Functions par HTTP
--          (toutes les notifications push en dépendent).
-- pg_cron : timer d'auto-refus des commandes + attribution automatique livreur.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- ─── 2. Types ENUM ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'app_role') then
    create type public.app_role as enum ('client', 'admin', 'livreur');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'order_status') then
    create type public.order_status as enum
      ('pending', 'accepted', 'refused', 'expired', 'ready', 'cancelled', 'delivering', 'delivered');
  end if;
end $$;

-- ─── 3. Tables (ordre de dépendance) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  avatar_url text
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  label text,
  address_type text NOT NULL,
  floor_number text,
  apartment_number text,
  full_address text NOT NULL,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  additional_info text,
  photo_url text,
  city text
);

CREATE TABLE IF NOT EXISTS public.livreurs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  nom text NOT NULL,
  telephone text NOT NULL,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category_id uuid,
  name text NOT NULL,
  description text,
  image_url text,
  is_available boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  color text,
  is_featured boolean DEFAULT false
);

-- Les PRIX vivent ici, jamais sur menu_items. Unité : dinar décimal
-- (13.000 = 13,000 TND, formaté côté client avec toFixed(3)).
CREATE TABLE IF NOT EXISTS public.menu_item_sizes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  menu_item_id uuid NOT NULL,
  size_label text NOT NULL,
  price numeric(10,3) NOT NULL,
  display_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.option_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  max_selection integer DEFAULT 1 NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.option_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  name text NOT NULL,
  price numeric DEFAULT 0 NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_item_option_groups (
  menu_item_id uuid NOT NULL,
  option_group_id uuid NOT NULL,
  display_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  total numeric(10,3) NOT NULL,
  status order_status DEFAULT 'pending'::order_status NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  special_instructions text,
  refusal_reason text,
  distance_km numeric,
  accepted_at timestamp with time zone,
  ready_at timestamp with time zone,
  delivering_at timestamp with time zone,
  delivered_at timestamp with time zone,
  estimated_ready_at timestamp with time zone,
  estimated_delivery_at timestamp with time zone,
  assigned_livreur_id uuid,
  arrival_at timestamp with time zone,
  address_id uuid,
  city text,
  pending_assignment boolean DEFAULT false NOT NULL,
  assignment_expires_at timestamp with time zone,
  tried_livreur_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  late_notification_sent boolean DEFAULT false,
  admin_notified_late boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  name text NOT NULL,
  size text,
  qty integer NOT NULL,
  unit_price numeric(10,3) NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  menu_item_id uuid
);

CREATE TABLE IF NOT EXISTS public.order_item_options (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_item_id uuid NOT NULL,
  option_item_id uuid,
  option_name text NOT NULL,
  option_price numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_ratings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer,
  comment text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  dismissed boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.livreur_ratings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  livreur_id uuid,
  user_id uuid NOT NULL,
  rating integer,
  comment text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  dismissed boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  order_id uuid,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  role text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer DEFAULT 1 NOT NULL,
  prep_time_minutes integer DEFAULT 20 NOT NULL
);

-- Secrets internes (push_trigger_secret). AUCUN grant anon/authenticated :
-- la table n'est lisible que par les fonctions SECURITY DEFINER.
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 4. Contraintes ────────────────────────────────────────────────────────
do $$
begin
  -- Clés primaires
  if not exists (select 1 from pg_constraint where conname = 'addresses_pkey') then
    ALTER TABLE public.addresses ADD CONSTRAINT addresses_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'admin_notifications_pkey') then
    ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'app_settings_pkey') then
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'categories_pkey') then
    ALTER TABLE public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'internal_config_pkey') then
    ALTER TABLE public.internal_config ADD CONSTRAINT internal_config_pkey PRIMARY KEY (key); end if;
  if not exists (select 1 from pg_constraint where conname = 'livreur_ratings_pkey') then
    ALTER TABLE public.livreur_ratings ADD CONSTRAINT livreur_ratings_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'livreurs_pkey') then
    ALTER TABLE public.livreurs ADD CONSTRAINT livreurs_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_item_option_groups_pkey') then
    ALTER TABLE public.menu_item_option_groups ADD CONSTRAINT menu_item_option_groups_pkey PRIMARY KEY (menu_item_id, option_group_id); end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_item_sizes_pkey') then
    ALTER TABLE public.menu_item_sizes ADD CONSTRAINT menu_item_sizes_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_items_pkey') then
    ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'option_groups_pkey') then
    ALTER TABLE public.option_groups ADD CONSTRAINT option_groups_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'option_items_pkey') then
    ALTER TABLE public.option_items ADD CONSTRAINT option_items_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_item_options_pkey') then
    ALTER TABLE public.order_item_options ADD CONSTRAINT order_item_options_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_pkey') then
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_messages_pkey') then
    ALTER TABLE public.order_messages ADD CONSTRAINT order_messages_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_ratings_pkey') then
    ALTER TABLE public.order_ratings ADD CONSTRAINT order_ratings_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_pkey') then
    ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_pkey') then
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_pkey') then
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id); end if;
  if not exists (select 1 from pg_constraint where conname = 'user_roles_pkey') then
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id); end if;

  -- Unicité
  if not exists (select 1 from pg_constraint where conname = 'livreurs_email_key') then
    ALTER TABLE public.livreurs ADD CONSTRAINT livreurs_email_key UNIQUE (email); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_ratings_order_id_key') then
    ALTER TABLE public.order_ratings ADD CONSTRAINT order_ratings_order_id_key UNIQUE (order_id); end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_endpoint_key') then
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint); end if;
  if not exists (select 1 from pg_constraint where conname = 'user_roles_user_id_role_key') then
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role); end if;

  -- CHECK
  if not exists (select 1 from pg_constraint where conname = 'addresses_address_type_check') then
    ALTER TABLE public.addresses ADD CONSTRAINT addresses_address_type_check CHECK ((address_type = ANY (ARRAY['house'::text, 'apartment'::text, 'workspace'::text]))); end if;
  if not exists (select 1 from pg_constraint where conname = 'single_row') then
    ALTER TABLE public.app_settings ADD CONSTRAINT single_row CHECK ((id = 1)); end if;
  if not exists (select 1 from pg_constraint where conname = 'livreur_ratings_rating_check') then
    ALTER TABLE public.livreur_ratings ADD CONSTRAINT livreur_ratings_rating_check CHECK ((((rating IS NULL) AND (dismissed = true)) OR ((rating >= 1) AND (rating <= 5)))); end if;
  if not exists (select 1 from pg_constraint where conname = 'option_groups_type_check') then
    ALTER TABLE public.option_groups ADD CONSTRAINT option_groups_type_check CHECK ((type = ANY (ARRAY['retirable'::text, 'supplement'::text]))); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_messages_content_len') then
    ALTER TABLE public.order_messages ADD CONSTRAINT order_messages_content_len CHECK (((char_length(content) >= 1) AND (char_length(content) <= 2000))); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_ratings_rating_check') then
    ALTER TABLE public.order_ratings ADD CONSTRAINT order_ratings_rating_check CHECK ((((rating IS NULL) AND (dismissed = true)) OR ((rating >= 1) AND (rating <= 5)))); end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_refusal_reason_check') then
    ALTER TABLE public.orders ADD CONSTRAINT orders_refusal_reason_check CHECK ((refusal_reason = ANY (ARRAY['unavailable'::text, 'busy'::text]))); end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_role_check') then
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_role_check CHECK ((role = ANY (ARRAY['client'::text, 'admin'::text, 'livreur'::text]))); end if;

  -- Clés étrangères
  if not exists (select 1 from pg_constraint where conname = 'addresses_user_id_fkey') then
    ALTER TABLE public.addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'admin_notifications_order_id_fkey') then
    ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id); end if;
  if not exists (select 1 from pg_constraint where conname = 'livreur_ratings_livreur_id_fkey') then
    ALTER TABLE public.livreur_ratings ADD CONSTRAINT livreur_ratings_livreur_id_fkey FOREIGN KEY (livreur_id) REFERENCES public.livreurs(id) ON DELETE SET NULL; end if;
  if not exists (select 1 from pg_constraint where conname = 'livreur_ratings_order_id_fkey') then
    ALTER TABLE public.livreur_ratings ADD CONSTRAINT livreur_ratings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'livreur_ratings_user_id_fkey') then
    ALTER TABLE public.livreur_ratings ADD CONSTRAINT livreur_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'livreurs_user_id_fkey') then
    ALTER TABLE public.livreurs ADD CONSTRAINT livreurs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_item_option_groups_menu_item_id_fkey') then
    ALTER TABLE public.menu_item_option_groups ADD CONSTRAINT menu_item_option_groups_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_item_option_groups_option_group_id_fkey') then
    ALTER TABLE public.menu_item_option_groups ADD CONSTRAINT menu_item_option_groups_option_group_id_fkey FOREIGN KEY (option_group_id) REFERENCES public.option_groups(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_item_sizes_menu_item_id_fkey') then
    ALTER TABLE public.menu_item_sizes ADD CONSTRAINT menu_item_sizes_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_items_category_id_fkey') then
    ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL; end if;
  if not exists (select 1 from pg_constraint where conname = 'option_items_group_id_fkey') then
    ALTER TABLE public.option_items ADD CONSTRAINT option_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.option_groups(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_item_options_option_item_id_fkey') then
    ALTER TABLE public.order_item_options ADD CONSTRAINT order_item_options_option_item_id_fkey FOREIGN KEY (option_item_id) REFERENCES public.option_items(id) ON DELETE SET NULL; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_item_options_order_item_id_fkey') then
    ALTER TABLE public.order_item_options ADD CONSTRAINT order_item_options_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_menu_item_id_fkey') then
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_order_id_fkey') then
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_messages_order_id_fkey') then
    ALTER TABLE public.order_messages ADD CONSTRAINT order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_messages_sender_id_fkey') then
    ALTER TABLE public.order_messages ADD CONSTRAINT order_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id); end if;
  if not exists (select 1 from pg_constraint where conname = 'order_ratings_order_id_fkey') then
    ALTER TABLE public.order_ratings ADD CONSTRAINT order_ratings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'order_ratings_user_id_fkey') then
    ALTER TABLE public.order_ratings ADD CONSTRAINT order_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_address_id_fkey') then
    ALTER TABLE public.orders ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE SET NULL; end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_assigned_livreur_id_fkey') then
    ALTER TABLE public.orders ADD CONSTRAINT orders_assigned_livreur_id_fkey FOREIGN KEY (assigned_livreur_id) REFERENCES public.livreurs(id); end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_user_id_fkey') then
    ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_user_id_fkey') then
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
  if not exists (select 1 from pg_constraint where conname = 'user_roles_user_id_fkey') then
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if;
end $$;

-- ─── 5. Index ──────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS one_default_address_per_user ON public.addresses USING btree (user_id) WHERE (is_default = true);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_order_id ON public.admin_notifications USING btree (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_ci ON public.categories USING btree (lower(TRIM(BOTH FROM name)));
CREATE INDEX IF NOT EXISTS idx_livreur_ratings_livreur_id ON public.livreur_ratings USING btree (livreur_id);
CREATE INDEX IF NOT EXISTS idx_livreur_ratings_user_id ON public.livreur_ratings USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS livreur_ratings_order_unique ON public.livreur_ratings USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_livreurs_user_id ON public.livreurs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_option_groups_option_group_id ON public.menu_item_option_groups USING btree (option_group_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_sizes_menu_item_id ON public.menu_item_sizes USING btree (menu_item_id);
-- Nom de plat unique DANS une catégorie (le même nom reste permis ailleurs :
-- « Detox » existe en Cocktails ET en Mojitos, « Overdose » en Crêpes ET Gaufres).
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_category_name_unique_ci ON public.menu_items USING btree (category_id, lower(TRIM(BOTH FROM name)));
CREATE INDEX IF NOT EXISTS idx_option_items_group_id ON public.option_items USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_option_item_id ON public.order_item_options USING btree (option_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id ON public.order_item_options USING btree (order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON public.order_items USING btree (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_id ON public.order_messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS order_messages_order_id_created_at_idx ON public.order_messages USING btree (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_ratings_user_id ON public.order_ratings USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_livreur_id ON public.orders USING btree (assigned_livreur_id) WHERE (assigned_livreur_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at_id ON public.orders USING btree (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON public.orders USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_address_id_idx ON public.orders USING btree (address_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles USING btree (phone) WHERE ((phone IS NOT NULL) AND (btrim(phone) <> ''::text));
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);

-- ─── 6. Fonctions ──────────────────────────────────────────────────────────

-- Sécurité des rôles : SECURITY DEFINER, seule source de vérité des rôles.
-- user_roles n'a AUCUNE policy d'écriture : impossible de s'auto-promouvoir
-- admin depuis l'app ; les rôles ne s'attribuent qu'en SQL (04_grant_roles).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.internal_secret(_key text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT value FROM public.internal_config WHERE key = _key;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  matched_livreur_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );

  -- Vérifie si cet email correspond à un livreur déjà enregistré
  SELECT id INTO matched_livreur_id
  FROM public.livreurs
  WHERE email = NEW.email
  LIMIT 1;

  IF matched_livreur_id IS NOT NULL THEN
    -- Lie la fiche livreur à ce compte auth
    UPDATE public.livreurs
    SET user_id = NEW.id
    WHERE id = matched_livreur_id;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'livreur');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_max_5_addresses()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (select count(*) from public.addresses where user_id = new.user_id) >= 5 then
    raise exception 'Limite de 5 adresses atteinte';
  end if;
  return new;
end;
$function$;

-- ZONE DE LIVRAISON — VALEUR PAR TENANT.
-- Doit rester STRICTEMENT synchronisée avec src/lib/geo.ts
-- (RESTAURANT_LOCATION / DELIVERY_RADIUS_KM). Le test Vitest src/lib/geo.test.ts
-- épingle les distances calculées ici : toute divergence TS↔SQL le fait échouer.
CREATE OR REPLACE FUNCTION public.enforce_delivery_zone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  rest_lat  CONSTANT double precision := 36.85607405239656;
  rest_lng  CONSTANT double precision := 10.15702900042228;
  radius_km CONSTANT double precision := 7;
  earth_km  CONSTANT double precision := 6371;
  d_lat double precision;
  d_lng double precision;
  h     double precision;
  dist_km double precision;
BEGIN
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RAISE EXCEPTION 'Adresse de livraison sans coordonnées : commande impossible à valider.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.lat = 0 AND NEW.lng = 0 THEN
    RAISE EXCEPTION 'Adresse de livraison invalide (coordonnées nulles).'
      USING ERRCODE = 'check_violation';
  END IF;

  d_lat := radians(NEW.lat - rest_lat);
  d_lng := radians(NEW.lng - rest_lng);
  h := sin(d_lat / 2) ^ 2
       + cos(radians(rest_lat)) * cos(radians(NEW.lat)) * sin(d_lng / 2) ^ 2;
  dist_km := earth_km * 2 * asin(sqrt(h));

  IF dist_km > radius_km THEN
    RAISE EXCEPTION
      'Adresse hors de la zone de livraison (% km > rayon % km).',
      round(dist_km::numeric, 2), radius_km
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.distance_km := dist_km;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_arrival_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  prep_minutes int;
  travel_minutes int;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select prep_time_minutes into prep_minutes from public.app_settings where id = 1;
    prep_minutes := coalesce(prep_minutes, 20);
    travel_minutes := ceil(coalesce(new.distance_km, 0) / 25.0 * 60.0)::int;
    new.arrival_at := now() + make_interval(mins => prep_minutes + travel_minutes);
    -- Ajout : horodatage de l'acceptation (event distinct de status/arrival_at).
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_push_subscription_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role not in ('client', 'admin', 'livreur') then
    raise exception 'Rôle invalide: %', new.role using errcode = '22023';
  end if;

  if new.role in ('admin', 'livreur') then
    if new.user_id is null
       or not public.has_role(new.user_id, new.role::app_role) then
      raise exception 'Rôle non autorisé pour cet utilisateur' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_role not in ('client', 'admin', 'livreur') then
    raise exception 'Rôle invalide: %', p_role using errcode = '22023';
  end if;

  -- Seul un utilisateur détenant réellement le rôle admin/livreur dans
  -- user_roles peut s'abonner aux notifications de ce rôle.
  if p_role in ('admin', 'livreur') and not public.has_role(uid, p_role::app_role) then
    raise exception 'Rôle non autorisé pour cet utilisateur' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, role, user_id)
    values (p_endpoint, p_p256dh, p_auth, p_role, uid)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        role = excluded.role,
        user_id = excluded.user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.shares_active_delivery(_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.orders o
    left join public.livreurs l on l.id = o.assigned_livreur_id
    where o.assigned_livreur_id is not null
      and o.status not in ('cancelled', 'expired', 'refused')
      and (o.status <> 'delivered' or o.delivered_at >= now() - interval '24 hours')
      and (
        (o.user_id = auth.uid() and l.user_id = _profile_id)
        or (o.user_id = _profile_id and l.user_id = auth.uid())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_access_order_chat(_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.orders o
    where o.id = _order_id
      and o.assigned_livreur_id is not null
      and o.status not in ('cancelled', 'expired', 'refused')
      and (o.status <> 'delivered' or o.delivered_at >= now() - interval '24 hours')
      and (
        o.user_id = auth.uid()
        or exists (
          select 1 from public.livreurs l
          where l.id = o.assigned_livreur_id
            and l.user_id = auth.uid()
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_order_livreur(p_order_id uuid)
 RETURNS TABLE(id uuid, nom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT l.id, l.nom
  FROM public.orders o
  JOIN public.livreurs l ON l.id = o.assigned_livreur_id
  WHERE o.id = p_order_id
    AND (
      o.user_id = auth.uid()
      OR l.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    );
$function$;

CREATE OR REPLACE FUNCTION public.send_order_message(p_order_id uuid, p_sender_id uuid, p_content text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING errcode = '42501';
  END IF;

  IF p_sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Expéditeur non autorisé' USING errcode = '42501';
  END IF;

  IF NOT public.can_access_order_chat(p_order_id) THEN
    RAISE EXCEPTION 'Accès à cette conversation non autorisé' USING errcode = '42501';
  END IF;

  IF p_content IS NULL OR btrim(p_content) = '' OR length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Message invalide' USING errcode = '22023';
  END IF;

  INSERT INTO public.order_messages (order_id, sender_id, content, created_at)
  VALUES (p_order_id, auth.uid(), btrim(p_content), NOW());
END;
$function$;

CREATE OR REPLACE FUNCTION public.livreur_update_order_status(p_order_id uuid, p_new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid       uuid := auth.uid();
  v_cur       order_status;
  v_livreur   uuid;
  v_assigned  boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_new_status not in ('delivering', 'delivered') then
    raise exception 'Statut non autorisé pour un livreur: %', p_new_status;
  end if;

  select o.status, o.assigned_livreur_id
    into v_cur, v_livreur
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  select exists (
    select 1 from public.livreurs l
    where l.id = v_livreur and l.user_id = v_uid
  ) into v_assigned;
  if not v_assigned then
    raise exception 'Commande non assignée à ce livreur' using errcode = '42501';
  end if;

  if p_new_status = 'delivering' then
    if v_cur <> 'ready' then
      raise exception 'Transition invalide : la commande n''est plus proposée';
    end if;
    update public.orders
      set status = 'delivering', delivering_at = now()
      where id = p_order_id;
  else
    if v_cur <> 'delivering' then
      raise exception 'Transition invalide : la commande n''est pas en livraison';
    end if;
    update public.orders
      set status = 'delivered', delivered_at = now()
      where id = p_order_id;
  end if;
end;
$function$;

-- CRÉATION DE COMMANDE SÉCURISÉE : recalcule TOUS les prix côté serveur
-- (le client n'envoie jamais de prix). Promo WELCOME10 (-10 % première
-- commande) CONSERVÉE telle quelle pour Jagger.
CREATE OR REPLACE FUNCTION public.create_order_secure(p_address_id uuid, p_special_instructions text, p_promo_code text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_name  text;
  v_phone text;
  v_addr  record;
  v_line  jsonb;
  v_item_id uuid;
  v_size    text;
  v_qty     int;
  v_note    text;
  v_opts    jsonb;
  v_available boolean;
  v_base    numeric;
  v_size_count int;
  v_opt_id    uuid;
  v_opt_name  text;
  v_opt_price numeric;
  v_opt_type  text;
  v_unit      numeric;
  v_subtotal  numeric := 0;
  v_order_id  uuid;
  v_order_item_id uuid;
  v_discount  numeric := 0;
  v_total     numeric;
  v_has_prior boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide';
  end if;

  select full_name, phone into v_name, v_phone from public.profiles where id = v_uid;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'Profil incomplet : nom requis';
  end if;

  select id, full_address, latitude, longitude, city
    into v_addr
  from public.addresses
  where id = p_address_id and user_id = v_uid;
  if v_addr.id is null then
    raise exception 'Adresse de livraison introuvable';
  end if;

  insert into public.orders (
    user_id, customer_name, phone, total, expires_at,
    address, address_id, city, lat, lng, special_instructions, status
  ) values (
    v_uid, v_name, coalesce(v_phone, ''), 0, now() + interval '2 minutes',
    v_addr.full_address, v_addr.id, v_addr.city, v_addr.latitude, v_addr.longitude,
    nullif(btrim(coalesce(p_special_instructions, '')), ''), 'pending'
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_items) as value
  loop
    v_item_id := (v_line->>'item_id')::uuid;
    v_size    := nullif(v_line->>'size', '');
    v_qty     := coalesce((v_line->>'qty')::int, 0);
    v_note    := nullif(v_line->>'note', '');
    v_opts    := coalesce(v_line->'options', '[]'::jsonb);

    if v_qty <= 0 then
      raise exception 'Quantité invalide pour l''article %', v_item_id;
    end if;

    select is_available into v_available from public.menu_items where id = v_item_id;
    if v_available is null then
      raise exception 'Article inconnu: %', v_item_id;
    end if;
    if v_available = false then
      raise exception 'Article indisponible: %', v_item_id;
    end if;

    if v_size is not null then
      select price into v_base
      from public.menu_item_sizes
      where menu_item_id = v_item_id and size_label = v_size;
      if v_base is null then
        raise exception 'Format « % » invalide pour l''article %', v_size, v_item_id;
      end if;
    else
      select count(*) into v_size_count
      from public.menu_item_sizes where menu_item_id = v_item_id;
      if v_size_count = 1 then
        select price into v_base
        from public.menu_item_sizes where menu_item_id = v_item_id;
      elsif v_size_count = 0 then
        raise exception 'Aucun tarif défini pour l''article %', v_item_id;
      else
        raise exception 'Format requis pour l''article %', v_item_id;
      end if;
    end if;

    v_unit := v_base;

    insert into public.order_items (order_id, menu_item_id, name, size, qty, unit_price, note)
    select v_order_id, v_item_id, mi.name, v_size, v_qty, 0, v_note
    from public.menu_items mi where mi.id = v_item_id
    returning id into v_order_item_id;

    for v_opt_id in
      select (jsonb_array_elements_text(v_opts))::uuid
    loop
      select oi.name, oi.price, og.type
        into v_opt_name, v_opt_price, v_opt_type
      from public.option_items oi
      join public.option_groups og on og.id = oi.group_id
      join public.menu_item_option_groups mog
        on mog.option_group_id = og.id and mog.menu_item_id = v_item_id
      where oi.id = v_opt_id;

      if v_opt_name is null then
        raise exception 'Option % non autorisée pour l''article %', v_opt_id, v_item_id;
      end if;

      if v_opt_type = 'supplement' then
        v_unit := v_unit + v_opt_price;
      else
        v_opt_price := 0;
      end if;

      insert into public.order_item_options (order_item_id, option_item_id, option_name, option_price)
      values (v_order_item_id, v_opt_id, v_opt_name, v_opt_price);
    end loop;

    update public.order_items set unit_price = v_unit where id = v_order_item_id;
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  if upper(btrim(coalesce(p_promo_code, ''))) = 'WELCOME10' then
    select exists (
      select 1 from public.orders
      where user_id = v_uid
        and id <> v_order_id
        and status in ('pending','accepted','ready','delivering','delivered')
    ) into v_has_prior;
    if not v_has_prior then
      v_discount := round(v_subtotal * 0.10, 3);
    end if;
  end if;

  v_total := round(v_subtotal - v_discount, 3);
  if v_total < 0 then v_total := 0; end if;

  update public.orders set total = v_total where id = v_order_id;

  return v_order_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(p_rating_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_rating_end timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  result jsonb;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with sold as (
    -- soldItems : items dont la commande n'est PAS pending/refused/expired/cancelled
    select oi.name, oi.qty, o.created_at
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status not in ('pending','refused','expired','cancelled')
  ),
  dish_qty as (
    select name, sum(qty)::bigint as qty from sold group by name
  ),
  svc as (
    select
      coalesce(sum(qty) filter (where h < 11), 0)               as matin,
      coalesce(sum(qty) filter (where h >= 11 and h < 17), 0)   as midi,
      coalesce(sum(qty) filter (where h >= 17), 0)              as soir
    from (select qty, extract(hour from (created_at at time zone 'Africa/Tunis'))::int as h from sold) s
  ),
  acc_f as (
    select extract(epoch from (accepted_at - created_at)) as dur
    from public.orders
    where accepted_at is not null
      and extract(epoch from (accepted_at - created_at)) >= 0
      and extract(epoch from (accepted_at - created_at)) < 3600
  ),
  ratings_valid as (
    select r.order_id, r.rating, r.created_at
    from public.order_ratings r
    where r.dismissed is not true and r.rating is not null
      and (p_rating_start is null or p_rating_end is null
           or (r.created_at >= p_rating_start and r.created_at <= p_rating_end))
  ),
  rating_dish as (
    select rv.rating, oi.name
    from ratings_valid rv
    join (select distinct order_id, name from public.order_items) oi on oi.order_id = rv.order_id
  )
  select jsonb_build_object(
    'dish_qty',    coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty)) from dish_qty), '[]'::jsonb),
    'service_map', (select jsonb_build_object('Matin', matin, 'Midi', midi, 'Soir', soir) from svc),
    'accept',      (select jsonb_build_object(
                       'avg_sec', coalesce(avg(dur), 0),
                       'min_sec', coalesce(min(dur), 0),
                       'max_sec', coalesce(max(dur), 0),
                       'count',   count(*)
                     ) from acc_f),
    'refused',     (select count(*) from public.orders where status='refused'),
    'unavailable', (select count(*) from public.orders where status='refused' and refusal_reason='unavailable'),
    'busy',        (select count(*) from public.orders where status='refused' and refusal_reason='busy'),
    'expired',     (select count(*) from public.orders where status='expired'),
    'cancelled',   (select count(*) from public.orders where status='cancelled'),
    'total_orders',(select count(*) from public.orders),
    'rating', jsonb_build_object(
      'count', (select count(*) from ratings_valid),
      'sum',   (select coalesce(sum(rating), 0) from ratings_valid),
      'distribution', coalesce((select jsonb_agg(jsonb_build_object('rating', g, 'count', c) order by g) from (
                        select gs as g, (select count(*) from ratings_valid where round(rating) = gs) as c
                        from generate_series(1,5) gs
                      ) d), '[]'::jsonb),
      'trend', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'sum', s, 'n', n) order by day) from (
                 select to_char(created_at at time zone 'Africa/Tunis', 'YYYY-MM-DD') as day,
                        sum(rating) s, count(*) n
                 from ratings_valid group by 1
               ) t), '[]'::jsonb),
      'dish_agg', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'sum', s, 'n', n)) from (
                    select name, sum(rating) s, count(*) n from rating_dish group by name
                  ) da), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_order_filters()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result json;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;
  select json_build_object(
    'clients', coalesce((
      select json_agg(json_build_object('user_id', user_id, 'customer_name', customer_name)
                      order by customer_name)
      from (select distinct on (user_id) user_id, customer_name
            from public.orders order by user_id, created_at desc) c), '[]'::json),
    'cities', coalesce((
      select json_agg(v order by v)
      from (select distinct city as v from public.orders
            where city is not null and btrim(city) <> '') s), '[]'::json),
    'addresses', coalesce((
      select json_agg(v order by v)
      from (select distinct address as v from public.orders
            where address is not null and btrim(address) <> '') s), '[]'::json)
  ) into result;
  return result;
end;
$function$;

-- Timer d'auto-refus : les commandes « pending » de plus de 2 min expirent.
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.orders
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - interval '2 minutes';
$function$;

CREATE OR REPLACE FUNCTION public.process_delivery_assignments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o record; chosen uuid;
begin
  update public.orders
     set tried_livreur_ids = array_append(tried_livreur_ids, assigned_livreur_id),
         assigned_livreur_id = null,
         assignment_expires_at = null
   where status = 'ready'
     and assigned_livreur_id is not null
     and assignment_expires_at is not null
     and assignment_expires_at < now();

  for o in
    select id, tried_livreur_ids from public.orders
     where status = 'ready' and assigned_livreur_id is null
     order by ready_at nulls first, created_at
  loop
    select l.id into chosen
    from public.livreurs l
    where l.is_active = true
      and not (l.id = any(o.tried_livreur_ids))
      and not exists (
        select 1 from public.orders b
        where b.assigned_livreur_id = l.id
          and (b.status = 'delivering'
               or (b.status = 'ready' and b.assignment_expires_at is not null
                   and b.assignment_expires_at > now())))
    order by l.created_at
    limit 1;

    if chosen is null then
      update public.orders
         set pending_assignment = true, tried_livreur_ids = '{}'
       where id = o.id and pending_assignment = false;
      if found then
        perform net.http_post(
          url := 'https://zouvaqadidzeieytanoa.supabase.co/functions/v1/notify-admin-unassigned',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', public.internal_secret('push_trigger_secret')
          ),
          body := jsonb_build_object('order_id', o.id));
      end if;
    else
      update public.orders
         set assigned_livreur_id = chosen,
             assignment_expires_at = now() + interval '2 minutes',
             pending_assignment = false
       where id = o.id;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_process_assignments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'not authorized'; end if;
  perform public.process_delivery_assignments();
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_late_deliveries()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  late_order record;
begin
  for late_order in
    select
      o.id,
      o.customer_name,
      o.phone,
      o.estimated_delivery_at,
      l.nom as livreur_nom
    from orders o
    left join livreurs l on l.id = o.assigned_livreur_id
    where o.status = 'delivering'
      and o.estimated_delivery_at < now()
      and o.admin_notified_late = false
  loop
    insert into admin_notifications (type, order_id, message, created_at)
    values (
      'commande_en_retard',
      late_order.id,
      'La commande #' || substr(late_order.id::text, 1, 8)
        || ' dépasse l''heure d''arrivée prévue'
        || E'\nClient: ' || coalesce(late_order.customer_name, 'N/A')
        || ' (' || coalesce(late_order.phone, 'N/A') || ')'
        || E'\nLivreur: ' || coalesce(late_order.livreur_nom, 'Non assigné'),
      now()
    );

    update orders
    set admin_notified_late = true
    where id = late_order.id;
  end loop;
end;
$function$;

-- ATTENTION — reprise à l'identique du projet de référence, où cette fonction
-- est DÉJÀ CASSÉE : elle lit `orders.order_number` (colonne inexistante) et
-- appelle l'Edge Function `send-push-notification` (jamais déployée). Elle est
-- donc conservée pour fidélité mais SON JOB CRON N'EST PAS PLANIFIÉ (cf. §10).
-- La détection de retard réellement active est notify_late_deliveries().
CREATE OR REPLACE FUNCTION public.check_late_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r record;
begin
  for r in
    select id, order_number
    from orders
    where status in ('accepted', 'ready', 'delivering')
      and estimated_ready_at < now()
      and late_notification_sent = false
  loop
    perform net.http_post(
      url := 'https://zouvaqadidzeieytanoa.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', public.internal_secret('push_trigger_secret')
      ),
      body := jsonb_build_object(
        'target', 'admin',
        'title', 'Commande en retard',
        'body', 'La commande #' || r.order_number || ' dépasse le délai prévu (toujours en préparation/livraison)'
      )
    );

    update orders set late_notification_sent = true where id = r.id;
  end loop;
end;
$function$;

-- ─── 7. Fonctions de trigger « push » (appellent les Edge Functions) ───────
CREATE OR REPLACE FUNCTION public.notify_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Ne notifier que sur un vrai changement de statut (évite un appel HTTP à
  -- chaque UPDATE : updated_at, position GPS, arrival_at, etc.).
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  perform net.http_post(
    url := 'https://zouvaqadidzeieytanoa.supabase.co/functions/v1/send-order-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', public.internal_secret('push_trigger_secret')
    ),
    -- Forme « Database Webhook » déjà supportée par la fonction
    -- (record / old_record), qui sait aussi lire { order_id, status } en direct.
    body := jsonb_build_object(
      'type', tg_op,
      'table', 'orders',
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    )
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_livreur_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.assigned_livreur_id is not null
     and new.assigned_livreur_id is distinct from old.assigned_livreur_id then
    perform net.http_post(
      url := 'https://zouvaqadidzeieytanoa.supabase.co/functions/v1/notify-livreur',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', public.internal_secret('push_trigger_secret')
      ),
      body := jsonb_build_object(
        'livreur_id', new.assigned_livreur_id,
        'order_id', new.id
      )
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_order_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform net.http_post(
    url := 'https://zouvaqadidzeieytanoa.supabase.co/functions/v1/notify-order-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', public.internal_secret('push_trigger_secret')
    ),
    body := jsonb_build_object(
      'message_id', new.id,
      'order_id', new.order_id,
      'sender_id', new.sender_id,
      'content', new.content
    )
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_late_delivery_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform net.http_post(
    url := 'https://zouvaqadidzeieytanoa.supabase.co/functions/v1/notify-admin-late-delivery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', public.internal_secret('push_trigger_secret')
    ),
    body := jsonb_build_object(
      'order_id', new.order_id,
      'message', new.message
    )
  );
  return new;
end;
$function$;

-- ─── 8. Triggers ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS internal_config_set_updated_at ON public.internal_config;
CREATE TRIGGER internal_config_set_updated_at BEFORE UPDATE ON public.internal_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS enforce_max_5_addresses ON public.addresses;
CREATE TRIGGER enforce_max_5_addresses BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.check_max_5_addresses();

DROP TRIGGER IF EXISTS trg_orders_enforce_delivery_zone ON public.orders;
CREATE TRIGGER trg_orders_enforce_delivery_zone BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_delivery_zone();

DROP TRIGGER IF EXISTS trg_set_arrival_at ON public.orders;
CREATE TRIGGER trg_set_arrival_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_arrival_at();

DROP TRIGGER IF EXISTS trg_order_status_notify ON public.orders;
CREATE TRIGGER trg_order_status_notify AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();

DROP TRIGGER IF EXISTS trg_order_livreur_assigned ON public.orders;
CREATE TRIGGER trg_order_livreur_assigned AFTER UPDATE OF assigned_livreur_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_livreur_assignment();

DROP TRIGGER IF EXISTS trg_order_message_notify ON public.order_messages;
CREATE TRIGGER trg_order_message_notify AFTER INSERT ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_message();

DROP TRIGGER IF EXISTS on_late_delivery_notification ON public.admin_notifications;
CREATE TRIGGER on_late_delivery_notification AFTER INSERT ON public.admin_notifications
  FOR EACH ROW WHEN ((new.type = 'commande_en_retard'::text))
  EXECUTE FUNCTION public.trigger_late_delivery_push();

DROP TRIGGER IF EXISTS push_subscriptions_enforce_role ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_enforce_role BEFORE INSERT OR UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_push_subscription_role();

-- Trigger sur auth.users (création du profil + rôle à l'inscription).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 9. RLS + policies ─────────────────────────────────────────────────────
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livreur_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livreurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- NB : toutes les policies enveloppent auth.uid() dans (select …) — optimisation
-- « initplan » (le sous-select est évalué une seule fois par requête, pas par
-- ligne). Ne pas déballer ces sous-requêtes.

DROP POLICY IF EXISTS addresses_select ON public.addresses;
CREATE POLICY addresses_select ON public.addresses AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR (EXISTS ( SELECT 1
   FROM (orders o
     JOIN livreurs l ON ((l.id = o.assigned_livreur_id)))
  WHERE ((o.address_id = addresses.id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))));
DROP POLICY IF EXISTS addresses_owner_insert ON public.addresses;
CREATE POLICY addresses_owner_insert ON public.addresses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
DROP POLICY IF EXISTS addresses_owner_update ON public.addresses;
CREATE POLICY addresses_owner_update ON public.addresses AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
DROP POLICY IF EXISTS addresses_owner_delete ON public.addresses;
CREATE POLICY addresses_owner_delete ON public.addresses AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS admin_notifications_admin_select ON public.admin_notifications;
CREATE POLICY admin_notifications_admin_select ON public.admin_notifications AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS app_settings_admin_select ON public.app_settings;
CREATE POLICY app_settings_admin_select ON public.app_settings AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_admin_update ON public.app_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS categories_public_select ON public.categories;
CREATE POLICY categories_public_select ON public.categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
CREATE POLICY categories_admin_insert ON public.categories AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS categories_admin_update ON public.categories;
CREATE POLICY categories_admin_update ON public.categories AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_admin_delete ON public.categories AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS livreur_ratings_select ON public.livreur_ratings;
CREATE POLICY livreur_ratings_select ON public.livreur_ratings AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR (livreur_id IN ( SELECT l.id
   FROM livreurs l
  WHERE (l.user_id = ( SELECT auth.uid() AS uid))))));
DROP POLICY IF EXISTS livreur_ratings_owner_insert ON public.livreur_ratings;
CREATE POLICY livreur_ratings_owner_insert ON public.livreur_ratings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) = ( SELECT o.user_id
   FROM orders o
  WHERE (o.id = livreur_ratings.order_id)))));
DROP POLICY IF EXISTS livreur_ratings_owner_update ON public.livreur_ratings;
CREATE POLICY livreur_ratings_owner_update ON public.livreur_ratings AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) = ( SELECT o.user_id
   FROM orders o
  WHERE (o.id = livreur_ratings.order_id)))));

DROP POLICY IF EXISTS livreurs_select ON public.livreurs;
CREATE POLICY livreurs_select ON public.livreurs AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)));
DROP POLICY IF EXISTS livreurs_admin_insert ON public.livreurs;
CREATE POLICY livreurs_admin_insert ON public.livreurs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS livreurs_admin_update ON public.livreurs;
CREATE POLICY livreurs_admin_update ON public.livreurs AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS livreurs_admin_delete ON public.livreurs;
CREATE POLICY livreurs_admin_delete ON public.livreurs AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS menu_item_option_groups_public_select ON public.menu_item_option_groups;
CREATE POLICY menu_item_option_groups_public_select ON public.menu_item_option_groups AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS menu_item_option_groups_admin_insert ON public.menu_item_option_groups;
CREATE POLICY menu_item_option_groups_admin_insert ON public.menu_item_option_groups AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS menu_item_option_groups_admin_update ON public.menu_item_option_groups;
CREATE POLICY menu_item_option_groups_admin_update ON public.menu_item_option_groups AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS menu_item_option_groups_admin_delete ON public.menu_item_option_groups;
CREATE POLICY menu_item_option_groups_admin_delete ON public.menu_item_option_groups AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS menu_item_sizes_public_select ON public.menu_item_sizes;
CREATE POLICY menu_item_sizes_public_select ON public.menu_item_sizes AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS menu_item_sizes_admin_insert ON public.menu_item_sizes;
CREATE POLICY menu_item_sizes_admin_insert ON public.menu_item_sizes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS menu_item_sizes_admin_update ON public.menu_item_sizes;
CREATE POLICY menu_item_sizes_admin_update ON public.menu_item_sizes AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS menu_item_sizes_admin_delete ON public.menu_item_sizes;
CREATE POLICY menu_item_sizes_admin_delete ON public.menu_item_sizes AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS menu_items_public_select ON public.menu_items;
CREATE POLICY menu_items_public_select ON public.menu_items AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS menu_items_admin_insert ON public.menu_items;
CREATE POLICY menu_items_admin_insert ON public.menu_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS menu_items_admin_update ON public.menu_items;
CREATE POLICY menu_items_admin_update ON public.menu_items AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS menu_items_admin_delete ON public.menu_items;
CREATE POLICY menu_items_admin_delete ON public.menu_items AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS option_groups_public_select ON public.option_groups;
CREATE POLICY option_groups_public_select ON public.option_groups AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS option_groups_admin_insert ON public.option_groups;
CREATE POLICY option_groups_admin_insert ON public.option_groups AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS option_groups_admin_update ON public.option_groups;
CREATE POLICY option_groups_admin_update ON public.option_groups AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS option_groups_admin_delete ON public.option_groups;
CREATE POLICY option_groups_admin_delete ON public.option_groups AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS option_items_public_select ON public.option_items;
CREATE POLICY option_items_public_select ON public.option_items AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS option_items_admin_insert ON public.option_items;
CREATE POLICY option_items_admin_insert ON public.option_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS option_items_admin_update ON public.option_items;
CREATE POLICY option_items_admin_update ON public.option_items AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS option_items_admin_delete ON public.option_items;
CREATE POLICY option_items_admin_delete ON public.option_items AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS order_item_options_select ON public.order_item_options;
CREATE POLICY order_item_options_select ON public.order_item_options AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR (EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.id = order_item_options.order_item_id) AND (o.user_id = ( SELECT auth.uid() AS uid)))))));
DROP POLICY IF EXISTS order_item_options_insert ON public.order_item_options;
CREATE POLICY order_item_options_insert ON public.order_item_options AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR (EXISTS ( SELECT 1
   FROM (order_items oi
     JOIN orders o ON ((o.id = oi.order_id)))
  WHERE ((oi.id = order_item_options.order_item_id) AND (o.user_id = ( SELECT auth.uid() AS uid)))))));
DROP POLICY IF EXISTS order_item_options_admin_update ON public.order_item_options;
CREATE POLICY order_item_options_admin_update ON public.order_item_options AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS order_item_options_admin_delete ON public.order_item_options;
CREATE POLICY order_item_options_admin_delete ON public.order_item_options AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));

DROP POLICY IF EXISTS order_items_select ON public.order_items;
CREATE POLICY order_items_select ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid)))))));
DROP POLICY IF EXISTS order_items_owner_insert ON public.order_items;
CREATE POLICY order_items_owner_insert ON public.order_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid))))));

DROP POLICY IF EXISTS order_messages_participants_select ON public.order_messages;
CREATE POLICY order_messages_participants_select ON public.order_messages AS PERMISSIVE FOR SELECT TO authenticated USING (can_access_order_chat(order_id));
DROP POLICY IF EXISTS order_messages_participants_insert ON public.order_messages;
CREATE POLICY order_messages_participants_insert ON public.order_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((sender_id = ( SELECT auth.uid() AS uid)) AND can_access_order_chat(order_id)));

DROP POLICY IF EXISTS order_ratings_select ON public.order_ratings;
CREATE POLICY order_ratings_select ON public.order_ratings AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)));
DROP POLICY IF EXISTS order_ratings_owner_insert ON public.order_ratings;
CREATE POLICY order_ratings_owner_insert ON public.order_ratings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) = ( SELECT o.user_id
   FROM orders o
  WHERE (o.id = order_ratings.order_id)))));
DROP POLICY IF EXISTS order_ratings_owner_update ON public.order_ratings;
CREATE POLICY order_ratings_owner_update ON public.order_ratings AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) = ( SELECT o.user_id
   FROM orders o
  WHERE (o.id = order_ratings.order_id)))));

DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR (assigned_livreur_id IN ( SELECT l.id
   FROM livreurs l
  WHERE (l.user_id = ( SELECT auth.uid() AS uid))))));
DROP POLICY IF EXISTS orders_owner_insert ON public.orders;
CREATE POLICY orders_owner_insert ON public.orders AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
DROP POLICY IF EXISTS orders_admin_update ON public.orders;
CREATE POLICY orders_admin_update ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)) WITH CHECK (( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role));
DROP POLICY IF EXISTS orders_owner_cancel ON public.orders;
CREATE POLICY orders_owner_cancel ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::order_status))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'cancelled'::order_status)));

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = id) OR shares_active_delivery(id)));
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = id));
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));

DROP POLICY IF EXISTS push_subscriptions_owner_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_select ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
DROP POLICY IF EXISTS push_subscriptions_owner_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_insert ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
DROP POLICY IF EXISTS push_subscriptions_owner_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_update ON public.push_subscriptions AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

-- user_roles : LECTURE SEULE côté client. Aucune policy INSERT/UPDATE/DELETE —
-- impossible de s'auto-attribuer « admin ». Les rôles ne se donnent qu'en SQL.
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role)));
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
CREATE POLICY "Users can read their own role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- internal_config : RLS activée SANS aucune policy → table totalement
-- inaccessible aux rôles anon/authenticated. Seules les fonctions
-- SECURITY DEFINER (internal_secret) peuvent la lire.

-- ─── 10. Privilèges ────────────────────────────────────────────────────────
-- Le secret push ne doit jamais transiter par PostgREST.
REVOKE ALL ON public.internal_config FROM anon, authenticated;
-- Écritures sur user_roles interdites même au niveau des GRANT (défense en
-- profondeur, en plus de l'absence de policy).
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

-- ─── 11. Realtime ──────────────────────────────────────────────────────────
-- Suivi de commande temps réel + chat client↔livreur.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='order_messages') then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end $$;

-- ─── 12. Storage : 3 buckets + policies ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dish-images',    'dish-images',    true,  2097152, array['image/jpeg','image/png','image/webp']),
  ('avatars',        'avatars',        true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('address-photos', 'address-photos', false, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Admins can view dish images" ON storage.objects;
CREATE POLICY "Admins can view dish images" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'dish-images'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
DROP POLICY IF EXISTS "Allow admins to upload dish images" ON storage.objects;
CREATE POLICY "Allow admins to upload dish images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'dish-images'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
DROP POLICY IF EXISTS "Admin upload dish images" ON storage.objects;
CREATE POLICY "Admin upload dish images" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'dish-images'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
DROP POLICY IF EXISTS "Admin update dish images" ON storage.objects;
CREATE POLICY "Admin update dish images" ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'dish-images'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
DROP POLICY IF EXISTS "Admin delete dish images" ON storage.objects;
CREATE POLICY "Admin delete dish images" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'dish-images'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));

-- Avatars : lecture publique (le bucket l'est), écriture réservée au compte
-- authentifié et cantonnée au dossier portant son uid. L'UPDATE porte un
-- WITH CHECK explicite — l'upload du front utilise `upsert: true`, donc
-- remplacer une photo passe par un UPDATE, qui ne doit pas pouvoir déplacer
-- l'objet vers le dossier d'un autre utilisateur. Voir aussi
-- 04_avatar_storage_policies.sql, qui rejoue ce bloc seul sur un projet déjà
-- installé.
DROP POLICY IF EXISTS "Public can view avatar images" ON storage.objects;
CREATE POLICY "Public can view avatar images" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));
DROP POLICY IF EXISTS "Avatar upload own" ON storage.objects;
CREATE POLICY "Avatar upload own" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid()))::text)));
DROP POLICY IF EXISTS "Avatar update own" ON storage.objects;
CREATE POLICY "Avatar update own" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid()))::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid()))::text)));
DROP POLICY IF EXISTS "Avatar delete own" ON storage.objects;
CREATE POLICY "Avatar delete own" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid()))::text)));

DROP POLICY IF EXISTS address_photos_owner_read ON storage.objects;
CREATE POLICY address_photos_owner_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'address-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS address_photos_owner_write ON storage.objects;
CREATE POLICY address_photos_owner_write ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING (((bucket_id = 'address-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'address-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS address_photos_admin_read ON storage.objects;
CREATE POLICY address_photos_admin_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'address-photos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS address_photos_assigned_livreur_read ON storage.objects;
CREATE POLICY address_photos_assigned_livreur_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'address-photos'::text) AND (EXISTS ( SELECT 1
   FROM (orders o
     JOIN livreurs l ON ((l.id = o.assigned_livreur_id)))
  WHERE ((l.user_id = auth.uid()) AND (o.address_id = ((storage.foldername(objects.name))[2])::uuid))))));

-- ─── 13. Jobs pg_cron ──────────────────────────────────────────────────────
-- Les jobs cron ne sont JAMAIS repris d'un projet à l'autre : on les recrée.
select cron.unschedule(jobid) from cron.job
 where jobname in ('expire-stale-orders-15s','process-delivery-assignments-15s','check-late-deliveries');

select cron.schedule('expire-stale-orders-15s',          '15 seconds', 'SELECT public.expire_stale_orders();');
select cron.schedule('process-delivery-assignments-15s', '15 seconds', 'select public.process_delivery_assignments();');
select cron.schedule('check-late-deliveries',            '* * * * *',  'select notify_late_deliveries();');

-- Volontairement NON planifié : le job « check-late-orders » du projet de
-- référence appelle check_late_orders(), cassée (colonne orders.order_number
-- inexistante + Edge Function send-push-notification jamais déployée). Il
-- échouerait à chaque minute. À réactiver seulement une fois la fonction
-- corrigée :
--   select cron.schedule('check-late-orders', '* * * * *', 'select check_late_orders();');
