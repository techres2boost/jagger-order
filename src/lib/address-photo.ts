// Feature 3 — helpers partagés pour la photo d'adresse (maison/appartement).
// Bucket privé `address-photos` : upload restreint au propriétaire, lecture
// signée (URL courte durée) côté client. Convention de chemin :
//   {user_id}/{address_id}/{filename}
import { supabase } from "@/integrations/supabase/client";

export const ADDRESS_PHOTOS_BUCKET = "address-photos";
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 Mo
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

// Validation côté client : type et taille. Renvoie un message d'erreur clair
// (à afficher tel quel) ou null si le fichier est acceptable.
export function validateAddressPhoto(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Format non supporté. Utilisez une image JPG ou PNG.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "Image trop lourde (2 Mo maximum).";
  }
  return null;
}

// Compression légère côté client : redimensionne à 1280px max et ré-encode en
// JPEG qualité 0.8. Best-effort : en cas d'échec on retombe sur le fichier
// d'origine (déjà validé < 2 Mo).
export async function compressAddressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

// Upload (compresse au passage) et renvoie le chemin de l'objet à stocker dans
// addresses.photo_url. Écrase toute photo précédente du même dossier adresse.
export async function uploadAddressPhoto(
  userId: string,
  addressId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const blob = await compressAddressPhoto(file);
  const path = `${userId}/${addressId}/photo_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(ADDRESS_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

// Génère une URL signée (1h) pour afficher une miniature. Renvoie null si le
// chemin est absent ou si l'accès est refusé (RLS).
export async function signAddressPhoto(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(ADDRESS_PHOTOS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
