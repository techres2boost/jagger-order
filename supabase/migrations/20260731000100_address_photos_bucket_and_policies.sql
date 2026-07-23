-- Feature 3: private storage bucket for address photos + RLS policies.
-- Read is intentionally NOT public: a home photo is sensitive. The UI renders
-- thumbnails through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('address-photos', 'address-photos', false, 2097152,
        ARRAY['image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object path convention: {user_id}/{address_id}/{filename}
--   foldername(name)[1] = owner user_id, foldername(name)[2] = address_id

-- Owner: full write on their own folder.
DROP POLICY IF EXISTS "address_photos_owner_write" ON storage.objects;
CREATE POLICY "address_photos_owner_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'address-photos'
         AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'address-photos'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- Owner: read own photos.
DROP POLICY IF EXISTS "address_photos_owner_read" ON storage.objects;
CREATE POLICY "address_photos_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'address-photos'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admin: read all address photos.
DROP POLICY IF EXISTS "address_photos_admin_read" ON storage.objects;
CREATE POLICY "address_photos_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'address-photos'
         AND public.has_role(auth.uid(), 'admin'));

-- Assigned livreur: read the photo of an address tied to an order assigned to them.
DROP POLICY IF EXISTS "address_photos_assigned_livreur_read" ON storage.objects;
CREATE POLICY "address_photos_assigned_livreur_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'address-photos'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.livreurs l ON l.id = o.assigned_livreur_id
      WHERE l.user_id = auth.uid()
        AND o.address_id = ((storage.foldername(name))[2])::uuid
    )
  );
