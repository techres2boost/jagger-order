-- ============================================================================
-- [Audit #5 — FAIBLE] Borne la longueur du contenu du chat côté base.
--
-- OrderChat.tsx limite la saisie à 500 caractères, mais ce n'est qu'applicatif
-- (contournable via un appel PostgREST direct). On ajoute une contrainte serveur.
-- La borne haute (2000) laisse une marge confortable au-dessus de la limite UI,
-- tout en empêchant l'insertion de contenus abusivement volumineux. La borne
-- basse (1) reflète l'invariant applicatif « pas de message vide ».
--
-- NB : si des lignes existantes violaient la contrainte, l'ALTER échouerait ;
-- order_messages.content étant NOT NULL et alimenté via un INSERT applicatif
-- borné, ce n'est pas attendu. En cas de besoin, valider d'abord avec :
--   SELECT count(*) FROM public.order_messages
--   WHERE char_length(content) NOT BETWEEN 1 AND 2000;
-- ============================================================================

ALTER TABLE public.order_messages
  ADD CONSTRAINT order_messages_content_len CHECK (char_length(content) BETWEEN 1 AND 2000);
