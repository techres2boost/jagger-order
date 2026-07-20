-- Étend le trigger existant handle_new_user() (déclenché par on_auth_user_created,
-- déjà en place) : si l'email du nouvel utilisateur correspond à un livreur
-- enregistré sans compte lié, on lie le compte et on ajoute le rôle 'livreur'.
-- Comportement inchangé pour tout autre email (flow client normal conservé).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  matched_livreur_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');

  -- Liaison automatique compte livreur <-> première connexion (Google OAuth)
  SELECT id INTO matched_livreur_id
  FROM public.livreurs
  WHERE email = NEW.email AND user_id IS NULL
  LIMIT 1;

  IF matched_livreur_id IS NOT NULL THEN
    UPDATE public.livreurs SET user_id = NEW.id WHERE id = matched_livreur_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'livreur')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
