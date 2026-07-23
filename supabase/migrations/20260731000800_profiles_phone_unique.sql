-- Unicité du téléphone sur profiles, en ignorant les valeurs vides/nulles
-- (profils incomplets) : index unique partiel, non destructif.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
