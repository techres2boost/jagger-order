-- =========================================================================
-- Correctif — « new row violates row-level security policy » à l'upload de la
-- photo de profil.
--
-- CAUSE
-- Le bucket `avatars` existe (sinon Storage répondrait « Bucket not found »),
-- mais storage.objects n'a AUCUNE policy d'écriture pour lui. Créer un bucket
-- depuis le Dashboard Supabase insère la ligne dans storage.buckets et rien
-- d'autre : la RLS de storage.objects est active par défaut et, sans policy
-- permissive correspondante, tout INSERT est refusé — y compris celui de
-- l'utilisateur sur son propre dossier.
--
-- CORRECTIF
-- (Re)crée le bucket avec ses limites et les 4 policies `avatars`. La RLS reste
-- activée ; l'écriture est réservée à `authenticated` et cantonnée au dossier
-- portant l'uid de l'utilisateur, ce que fait déjà le client
-- (src/components/ProfileAvatar.tsx écrit sous `{user.id}/avatar.{ext}`).
--
-- Ne touche à aucune table, fonction, trigger, index, ni à une policy autre que
-- les 4 policies `avatars` nommées ici. Idempotent.
--
-- À exécuter dans le SQL Editor Supabase.
-- =========================================================================

-- ─── 1. Bucket ────────────────────────────────────────────────────────────
-- Public en lecture (les avatars s'affichent côté client et livreur), 5 Mo max,
-- images uniquement — mêmes valeurs que celles attendues par le front
-- (MAX_BYTES = 5 Mo, ACCEPTED = jpeg/png/webp).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── 2. Policies ──────────────────────────────────────────────────────────
-- Lecture : publique, le bucket l'est déjà. Sans cette policy, l'avatar ne
-- s'afficherait pas pour les autres utilisateurs (chat client↔livreur).
drop policy if exists "Public can view avatar images" on storage.objects;
create policy "Public can view avatar images"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Écriture : réservée aux comptes authentifiés, et uniquement dans le dossier
-- qui porte leur propre uid. storage.foldername() renvoie les segments de
-- dossier sans le nom de fichier : pour « <uid>/avatar.jpg », [1] vaut <uid>.
drop policy if exists "Avatar upload own" on storage.objects;
create policy "Avatar upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- L'upload du front utilise `upsert: true` : remplacer une photo existante
-- passe par un UPDATE, qui a donc besoin de sa propre policy. USING filtre la
-- ligne visée, WITH CHECK empêche de la déplacer vers le dossier d'autrui.
drop policy if exists "Avatar update own" on storage.objects;
create policy "Avatar update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Avatar delete own" on storage.objects;
create policy "Avatar delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ─── 3. Contrôle ──────────────────────────────────────────────────────────
-- Attendu : le bucket `avatars` public/5242880, et 4 policies.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avatars';

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Public can view avatar images',
    'Avatar upload own',
    'Avatar update own',
    'Avatar delete own'
  )
order by policyname;
