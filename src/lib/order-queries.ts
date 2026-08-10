// Forme de requête partagée pour charger des commandes AVEC leurs lignes et les
// options de chaque ligne.
//
// POURQUOI
// Les écrans admin / livreur / client faisaient chacun trois allers-retours
// SÉQUENTIELS : orders → order_items (in: ids) → order_item_options (in: ids).
// Chaque aller-retour ajoute une latence réseau complète, et le troisième ne
// peut même pas démarrer avant la fin du deuxième. PostgREST sait résoudre les
// trois niveaux en une seule requête grâce aux clés étrangères existantes
// (order_items.order_id, order_item_options.order_item_id) : on passe de 3 RTT
// à 1, sans rien changer au schéma ni aux policies (l'imbrication reste soumise
// à la RLS de chaque table).

export const ORDER_WITH_ITEMS_SELECT =
  "*, order_items(*, order_item_options(order_item_id, option_name, option_price))";

export interface OrderItemOptionLike {
  order_item_id: string;
  option_name: string;
  option_price: number;
}

interface RawOption {
  order_item_id: string;
  option_name: string;
  option_price: number | string;
}

interface RawItem {
  id: string;
  order_id: string;
  order_item_options?: RawOption[] | null;
  [key: string]: unknown;
}

interface RawOrder {
  id: string;
  order_items?: RawItem[] | null;
  [key: string]: unknown;
}

/**
 * Sépare la réponse imbriquée en les trois structures que les écrans utilisent
 * déjà (commandes nues, lignes par commande, options par ligne), pour que le
 * reste des composants soit inchangé.
 */
export function splitOrdersWithItems<TOrder, TItem>(
  rows: unknown,
): {
  orders: TOrder[];
  items: Record<string, TItem[]>;
  itemOptions: Record<string, OrderItemOptionLike[]>;
} {
  const list = (rows as RawOrder[] | null) ?? [];
  const orders: TOrder[] = [];
  const items: Record<string, TItem[]> = {};
  const itemOptions: Record<string, OrderItemOptionLike[]> = {};

  for (const row of list) {
    const { order_items: rawItems, ...order } = row;
    orders.push(order as TOrder);

    for (const item of rawItems ?? []) {
      const { order_item_options: rawOptions, ...rest } = item;
      (items[item.order_id] ||= []).push(rest as TItem);

      for (const option of rawOptions ?? []) {
        (itemOptions[item.id] ||= []).push({
          order_item_id: option.order_item_id,
          option_name: option.option_name,
          // `numeric` arrive en chaîne via PostgREST : on normalise ici, comme
          // le faisaient les trois requêtes séparées.
          option_price: Number(option.option_price),
        });
      }
    }
  }

  return { orders, items, itemOptions };
}
