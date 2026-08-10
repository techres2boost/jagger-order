// Coordonnées de contact du restaurant — valeurs par tenant, regroupées ici
// pour qu'un changement de client ne touche qu'un fichier.
//
// Le reste de l'identité vit dans deux autres endroits, volontairement :
//   * nom, logo et couleurs        → src/lib/theme-context.tsx ;
//   * zone de livraison (GPS/rayon) → src/lib/geo.ts, à garder synchronisé avec
//     le trigger Postgres enforce_delivery_zone().

/** Numéro au format E.164, pour les liens `tel:`. */
export const RESTAURANT_PHONE_E164 = "+21644125122";

/** Numéro tel qu'affiché au client (format local tunisien). */
export const RESTAURANT_PHONE_DISPLAY = "44 125 122";

/** Lien de discussion WhatsApp du restaurant. */
export const RESTAURANT_WHATSAPP_URL = "https://wa.me/21644125122";
