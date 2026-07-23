-- Feature 3: address photo + city capture + order↔address link
-- addresses gains an optional home/apartment photo and a captured city
-- (city comes from the map's reverse-geocode at save time — no export-time geocoding).
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS city     text;

-- orders link back to the address used, plus a denormalized city snapshot so
-- historical exports/filters stay correct even if the address is edited/deleted
-- (mirrors the existing denormalized orders.address text).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city       text;

CREATE INDEX IF NOT EXISTS orders_address_id_idx ON public.orders (address_id);
