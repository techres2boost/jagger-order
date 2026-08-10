// Données menu JAGGER — transcrites strictement d'après la carte fournie par le
// client. Aucun prix, nom ou description n'est inventé.
//
// RÔLE DE CE FICHIER
// La base Supabase reste la source de vérité à l'exécution (l'admin peut créer /
// modifier des plats). Ce module sert à deux choses, et à rien d'autre :
//   1. le mapping plat → catégorie du dashboard admin (répartition des ventes) ;
//   2. la génération du seed SQL et du manifeste d'images
//      (`node scripts/generate-menu-seed.mjs`).
// Les PRIX vivent dans menu_item_sizes côté base ; ici ils sont exprimés dans la
// même unité : dinar décimal (9.5 = 9,500 TND).

export interface MenuCategory {
  slug: string;
  name: string;
}

export interface MenuDish {
  name: string;
  category: string; // MenuCategory.slug
  price: number; // dinars décimaux
  description?: string;
  /** Chemin de l'image dans le dépôt, relatif à `menu/`. */
  image?: string;
  featured?: boolean;
  /** Clés de OPTION_GROUPS rattachées au plat. */
  options?: string[];
}

export interface MenuOptionGroup {
  key: string;
  name: string;
  type: "retirable" | "supplement";
  maxSelection: number;
  items: { name: string; price: number }[];
}

export const CATEGORIES: MenuCategory[] = [
  { slug: "cafes", name: "Cafés" },
  { slug: "signatures", name: "Signatures" },
  { slug: "thes", name: "Thés" },
  { slug: "jus-frais", name: "Jus frais" },
  { slug: "cocktails", name: "Cocktails" },
  { slug: "mojitos", name: "Mojitos" },
  { slug: "milkshakes", name: "Milkshakes" },
  { slug: "frappuccinos", name: "Frappuccinos" },
  { slug: "chocolats", name: "Chocolats" },
  { slug: "smoothie-bowls", name: "Smoothie bowls" },
  { slug: "desserts", name: "Desserts" },
  { slug: "crepes-sucrees", name: "Crêpes sucrées" },
  { slug: "crepes-salees", name: "Crêpes salées" },
  { slug: "gaufres-sucrees", name: "Gaufres sucrées" },
  { slug: "gaufres-salees", name: "Gaufres salées" },
  { slug: "pancakes", name: "Pancakes" },
  { slug: "sandwichs", name: "Sandwichs" },
  { slug: "salades", name: "Salades" },
  { slug: "pasta", name: "Pasta" },
  { slug: "plats", name: "Plats" },
  { slug: "chichas", name: "Chichas" },
  { slug: "boissons", name: "Boissons" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.name]),
);

// Seul groupe d'options dérivable de la carte : les parfums de chicha, vendus au
// même prix (choix unique, sans supplément) — d'où le type "retirable".
export const OPTION_GROUPS: MenuOptionGroup[] = [
  {
    key: "parfum-chicha",
    name: "Parfum",
    type: "retirable",
    maxSelection: 1,
    items: [
      { name: "Pomme", price: 0 },
      { name: "Menthe", price: 0 },
      { name: "Raisin", price: 0 },
      { name: "Pêche", price: 0 },
      { name: "Cerise", price: 0 },
      { name: "Chewing-Gum", price: 0 },
      { name: "Pastèque", price: 0 },
      { name: "Citron", price: 0 },
      { name: "Mojito", price: 0 },
    ],
  },
];

export const MENU: MenuDish[] = [
  // ─── Cafés ───────────────────────────────────────────────────────────────
  { name: "Espresso", category: "cafes", price: 4.5, image: "cafés/Espresso.webp" },
  { name: "Espresso Nespresso", category: "cafes", price: 6.5, image: "cafés/Espresso Nespresso.webp" },
  { name: "Macchiato", category: "cafes", price: 5, image: "cafés/Macchiato.webp" },
  { name: "Macchiato Nespresso", category: "cafes", price: 7, image: "cafés/Macchiato Nespresso.webp" },
  { name: "Cappuccino Crème", category: "cafes", price: 5.5, image: "cafés/Cappuccino Crème.webp" },
  { name: "Café Crème Nespresso", category: "cafes", price: 7.5, image: "cafés/Café Crème Nespresso.webp" },
  { name: "Espresso Americano", category: "cafes", price: 5, image: "cafés/Americano Nespresso.webp" },
  { name: "Café Turc", category: "cafes", price: 7, image: "cafés/Café Turc.webp" },
  { name: "Nescafé au Lait", category: "cafes", price: 7, image: "cafés/Nescafé au Lait.webp" },

  // ─── Signatures ──────────────────────────────────────────────────────────
  { name: "Café Brownies", category: "signatures", price: 9, image: "signatures/Café Brownies.webp", featured: true },
  { name: "Café Cookies", category: "signatures", price: 9, image: "signatures/Café Cookies.webp" },
  { name: "Café Chocolat", category: "signatures", price: 9, image: "signatures/Café Chocolat.webp" },

  // ─── Thés ────────────────────────────────────────────────────────────────
  { name: "Thé Tunisien à la Menthe", category: "thes", price: 4, description: "avec petits biscuits", image: "thés/Thé Tunisien à la Menthe.webp" },
  { name: "Thé aux Amandes", category: "thes", price: 6.5, image: "thés/Thé aux Amandes.webp" },
  { name: "Thé Infusion au Choix", category: "thes", price: 6, image: "thés/Thé Infusion au Choix.webp" },
  { name: "Thé aux Pignons", category: "thes", price: 10, image: "thés/Thé aux Pignons.webp" },
  { name: "Thé aux Fruits Secs", category: "thes", price: 11, description: "amandes, noix, noisettes", image: "thés/Thé aux Fruits Secs.webp" },

  // ─── Jus frais ───────────────────────────────────────────────────────────
  { name: "Citronnade", category: "jus-frais", price: 6, image: "jus frais/Citronnade.webp" },
  { name: "Jus d'Orange", category: "jus-frais", price: 6, image: "jus frais/jus d'orange.webp" },
  { name: "Jus de Fraise", category: "jus-frais", price: 7, image: "jus frais/jus de fraise.webp" },
  { name: "Jus de Pomme", category: "jus-frais", price: 7, image: "jus frais/Jus de Pomme.webp" },
  { name: "Jus de Pêche", category: "jus-frais", price: 7, image: "jus frais/Jus de Pêche.webp" },
  { name: "Citronnade aux Amandes", category: "jus-frais", price: 8, image: "jus frais/citronnade aux amandes.webp" },
  { name: "Lait de Poule", category: "jus-frais", price: 8, image: "jus frais/Lait de Poule.webp" },
  { name: "Jus d'Ananas", category: "jus-frais", price: 10, image: "jus frais/Jus d'Ananas.webp" },
  { name: "Jus de Kiwi", category: "jus-frais", price: 12, image: "jus frais/jus de kiwi.webp" },

  // ─── Cocktails ───────────────────────────────────────────────────────────
  { name: "Ice Berg", category: "cocktails", price: 12, description: "sorbet citron, citronnade, framboise, menthe", image: "cocktails/Ice Berg.webp" },
  { name: "Slushy", category: "cocktails", price: 11, description: "fraise, kiwi, banane, orange", image: "cocktails/Slushy.webp" },
  { name: "Pina Colada", category: "cocktails", price: 11, description: "ananas, noix de coco", image: "cocktails/Pina Colada.webp" },
  { name: "Red Moon", category: "cocktails", price: 13, description: "fraise, banane, cassis, glace vanille", image: "cocktails/red moon.webp" },
  { name: "Detox", category: "cocktails", price: 12, description: "kiwi, pomme, épinard, citron", image: "cocktails/detox.webp" },
  { name: "Blue Breeze", category: "cocktails", price: 12, description: "ananas, mangue, curaçao bleu, noix de coco", image: "cocktails/Blue Breeze.webp" },
  { name: "Energy Power", category: "cocktails", price: 13, description: "ananas, kiwi, menthe, basilic", image: "cocktails/Energy Power.webp" },

  // ─── Mojitos ─────────────────────────────────────────────────────────────
  { name: "Mojito Classique", category: "mojitos", price: 9, image: "mojitos/Mojito Classique.webp" },
  { name: "Mojito Fraise", category: "mojitos", price: 10, image: "mojitos/Mojito Fraise.webp" },
  { name: "Mojito Myrtilles", category: "mojitos", price: 10, image: "mojitos/mojito myrtilles.webp" },
  { name: "Mojito Pomme", category: "mojitos", price: 10, image: "mojitos/Mojito Pomme.webp" },
  { name: "Mojito Rose", category: "mojitos", price: 10, image: "mojitos/Mojito Rose.webp" },
  { name: "Passion", category: "mojitos", price: 11, description: "fruits de la passion", image: "mojitos/Passion.webp" },
  { name: "Detox", category: "mojitos", price: 11, description: "menthe, citron, concombre, gingembre", image: "mojitos/detox.webp" },
  { name: "Big Power Redbull", category: "mojitos", price: 14, image: "mojitos/Big Power Redbull.webp" },
  { name: "Big Boss", category: "mojitos", price: 38, description: "pour 4 personnes", image: "mojitos/big boss.webp", featured: true },

  // ─── Milkshakes ──────────────────────────────────────────────────────────
  { name: "Chocolat / Vanille / Fraise", category: "milkshakes", price: 10, image: "milkshakes/Chocolat Vanille Fraise.webp" },
  { name: "Oreo / Nutella / Speculoos", category: "milkshakes", price: 12, image: "milkshakes/oreo.webp" },
  { name: "Mars", category: "milkshakes", price: 12, image: "milkshakes/mars.webp" },
  { name: "Kinder", category: "milkshakes", price: 13, image: "milkshakes/kinder.webp" },
  { name: "Ferrero Rocher", category: "milkshakes", price: 14, image: "milkshakes/frerrero rocher.webp" },
  { name: "Big Choc", category: "milkshakes", price: 15, description: "Oreo, Nutella, Kinder, M&M's", image: "milkshakes/Big Choc.webp", featured: true },

  // ─── Frappuccinos ────────────────────────────────────────────────────────
  { name: "Caramel / Noisettes", category: "frappuccinos", price: 10, image: "frappuccinos/Caramel  Noisettes.webp" },
  { name: "Nutella / Spéculoos", category: "frappuccinos", price: 12, image: "frappuccinos/Nutella Spéculoos.webp" },

  // ─── Chocolats ───────────────────────────────────────────────────────────
  { name: "Chocolat Chaud / Cold Chocolate", category: "chocolats", price: 9, image: "chocolats/Chocolat Chaud Cold Chocolate.webp" },
  { name: "Chocolat Chaud Caramel / Oreo / Speculoos", category: "chocolats", price: 12, image: "chocolats/Chocolat Chaud Caramel Oreo  Speculoos.webp" },
  { name: "ChoSec", category: "chocolats", price: 12, description: "amandes et noisettes concassées", image: "chocolats/ChoSec.webp" },

  // ─── Smoothie bowls ──────────────────────────────────────────────────────
  { name: "Green", category: "smoothie-bowls", price: 14, description: "pomme, kiwi, avoine, graines", image: "smoothie bowls/Green.webp" },
  { name: "Red", category: "smoothie-bowls", price: 14, description: "framboise, cassis, fraise, avoine", image: "smoothie bowls/red.webp" },
  { name: "Brown", category: "smoothie-bowls", price: 14, description: "banane, dattes, beurre de cacahuète, chocolat", image: "smoothie bowls/brown.webp" },
  { name: "Jwejem", category: "smoothie-bowls", price: 10, description: "yaourt glacé nature", image: "smoothie bowls/jwejem.webp" },
  { name: "Warrior", category: "smoothie-bowls", price: 12, description: "yaourt + fruits séchés, frais, avoine", image: "smoothie bowls/warrior.webp" },

  // ─── Desserts ────────────────────────────────────────────────────────────
  { name: "Fondant au Chocolat", category: "desserts", price: 10, image: "dessets/fondant au choxolat.webp" },
  { name: "Tiramisu", category: "desserts", price: 13, image: "dessets/tiramissu.webp" },
  { name: "Knefa", category: "desserts", price: 10, image: "dessets/knefa.webp" },
  { name: "Assiette de Fruits de Saison", category: "desserts", price: 15, description: "pour 2", image: "dessets/Assiette de Fruits de Saison.webp" },
  { name: "Glace 2 Boules", category: "desserts", price: 9, image: "dessets/Glace 2 Boules.webp" },
  { name: "Glace 3 Boules avec fruits secs", category: "desserts", price: 12, image: "dessets/Glace 3 Boules avec fruits secs.webp" },
  { name: "Banana Split", category: "desserts", price: 13, image: "dessets/Banana Split.webp" },

  // ─── Crêpes sucrées ──────────────────────────────────────────────────────
  { name: "PICK ME UP", category: "crepes-sucrees", price: 9.5, description: "Nutella, fruits", image: "crepes sucrées/pick me up.webp" },
  { name: "OUT OF AFRICA", category: "crepes-sucrees", price: 10, description: "caramel, noisettes", image: "crepes sucrées/out of africa.webp" },
  { name: "UP-TODATE", category: "crepes-sucrees", price: 12, description: "fruits rouges, crème", image: "crepes sucrées/UP-TODATE.webp" },
  { name: "Biscoff", category: "crepes-sucrees", price: 13, description: "biscoff, banane", image: "crepes sucrées/Biscoff.webp" },
  { name: "TRI-SHOT", category: "crepes-sucrees", price: 13, description: "Nutella, banane, chocolat", image: "crepes sucrées/TRI-SHOT.webp" },
  { name: "BLACK JAGGER", category: "crepes-sucrees", price: 14, description: "Jagermeister, banane", image: "crepes sucrées/BLACK JAGGER.webp", featured: true },
  { name: "PUMP IT UP", category: "crepes-sucrees", price: 14, description: "Nutella, banane", image: "crepes sucrées/pump it up.webp" },
  { name: "DOLCEZZZA BIANCA", category: "crepes-sucrees", price: 15, description: "mascarpone, fruits", image: "crepes sucrées/DOLCEZZZA BIANCA.webp" },
  { name: "OVERDOSE", category: "crepes-sucrees", price: 16, description: "Nutella, banane, crème", image: "crepes sucrées/overdose.webp" },

  // ─── Crêpes salées ───────────────────────────────────────────────────────
  { name: "TONINO", category: "crepes-salees", price: 12, description: "fromage, tomate", image: "crepes salées/tanino.webp" },
  { name: "TI-PUNCH", category: "crepes-salees", price: 12, description: "poulet, sauce barbecue", image: "crepes salées/TI-PUNCH.webp" },
  { name: "CARAMBA", category: "crepes-salees", price: 13, description: "fromage, spéculoos", image: "crepes salées/CARAMBA.webp" },
  { name: "MEXICAINE", category: "crepes-salees", price: 13, description: "poulet, épices mexicaines", image: "crepes salées/mexicane.webp" },
  { name: "MOSKOVA", category: "crepes-salees", price: 18, description: "fromage, crème, légumes", image: "crepes salées/MOSKOVA.webp" },

  // ─── Gaufres sucrées ─────────────────────────────────────────────────────
  { name: "Lovely", category: "gaufres-sucrees", price: 11, description: "Nutella, pépites chocolat", image: "gaufres sucrées/lovely.webp" },
  { name: "So-Sec", category: "gaufres-sucrees", price: 13.5, description: "Nutella, fruits secs", image: "gaufres sucrées/so-sec.webp" },
  { name: "Tofifee", category: "gaufres-sucrees", price: 13, description: "caramel, banane, noisettes", image: "gaufres sucrées/Tofifee.webp" },
  { name: "Boreo", category: "gaufres-sucrees", price: 14, description: "Nutella, banane, Oreo", image: "gaufres sucrées/boreo.webp" },
  { name: "Paradice", category: "gaufres-sucrees", price: 14, description: "chocolat blanc, fruits rouges", image: "gaufres sucrées/Paradice.webp" },
  { name: "Overdose", category: "gaufres-sucrees", price: 17, description: "Nutella, Oreo, choc blanc, Kinder, Mars, 2 boules glace", image: "gaufres sucrées/overdose.webp", featured: true },

  // ─── Gaufres salées ──────────────────────────────────────────────────────
  { name: "Chicken", category: "gaufres-salees", price: 14, description: "poulet pané, fromage, roquette, légumes confits", image: "gaufres salées/Chicken.webp" },
  { name: "Gaufre 3 Fromages", category: "gaufres-salees", price: 16, description: "mozzarella, gorgonzola, raclette, noix, abricots", image: "gaufres salées/Gaufre 3 Fromages.webp" },
  { name: "Guido's", category: "gaufres-salees", price: 17, description: "bresaola, gouda, champignons, roquette", image: "gaufres salées/Guido's.webp" },

  // ─── Pancakes ────────────────────────────────────────────────────────────
  { name: "Banoffee Classique", category: "pancakes", price: 13, description: "caramel, banane, noix", image: "pancakes/Banoffee Classique.webp" },
  { name: "Banoffee Cremosa", category: "pancakes", price: 15, description: "caramel, banane, noix + mascarpone", image: "pancakes/Banoffee Cremosa.webp" },
  { name: "The Berry One Classique", category: "pancakes", price: 15, description: "Nutella, Oreo, fruits rouges", image: "pancakes/The Berry One Classique.webp" },
  { name: "The Berry One Cremosa", category: "pancakes", price: 17, description: "Nutella, Oreo, fruits rouges + mascarpone", image: "pancakes/The Berry One Cremosa.webp" },
  { name: "Frutti Classique", category: "pancakes", price: 14, description: "Nutella, fraise, banane, kiwi", image: "pancakes/Frutti Classique.webp" },
  { name: "Frutti Cremosa", category: "pancakes", price: 16, description: "Nutella, fraise, banane, kiwi + mascarpone", image: "pancakes/Frutti Cremosa.webp" },

  // ─── Sandwichs ───────────────────────────────────────────────────────────
  { name: "Me So HUngrI", category: "sandwichs", price: 12, description: "escalope grillée, mozzarella, gouda, roquette – servi avec frites", image: "sandwitchs/Me So HUngrI.webp" },
  { name: "Kaporal", category: "sandwichs", price: 13, description: "escalope panée, mozzarella, jambon, amandes", image: "sandwitchs/Kaporal.webp" },
  { name: "Pacific", category: "sandwichs", price: 14, description: "dinde mexicaine, mozzarella, bacon", image: "sandwitchs/Pacific.webp" },
  { name: "B52", category: "sandwichs", price: 15, description: "viande hachée, mozzarella, pepperoni, gouda, noisettes", image: "sandwitchs/b52.webp" },

  // ─── Salades ─────────────────────────────────────────────────────────────
  { name: "Salade Fraîcheur", category: "salades", price: 15, description: "laitue, thon, légumes, œuf dur", image: "salades/Salade Fraîcheur.webp" },
  { name: "Salade César", category: "salades", price: 18, description: "poulet pané, parmesan, tomates cerises, noix", image: "salades/salade cesar.webp", featured: true },
  { name: "Camembert Chaud", category: "salades", price: 22, description: "toasts, oignons caramélisés, figues, miel", image: "salades/Camembert Chaud.webp" },
  { name: "Salade Exotique", category: "salades", price: 23, description: "bresaola, avocat, kiwi, pommes, noix", image: "salades/Salade Exotique.webp" },
  { name: "Burrata Bresaola", category: "salades", price: 25, description: "roquette, figues séchées, crème balsamique", image: "salades/Burrata Bresaola.webp" },

  // ─── Pasta ───────────────────────────────────────────────────────────────
  { name: "Puttanesca", category: "pasta", price: 18, description: "spaghetti/penne, thon, olives, câpres" },
  { name: "Spaghetti aux Boulettes", category: "pasta", price: 20, description: "parmesan", image: "pasta/Spaghetti aux Boulettes.webp" },
  { name: "Penne Poulet Pané", category: "pasta", price: 23 },
  { name: "Tagliatelles con Pollo e Spinacci", category: "pasta", price: 24, description: "sauce blanche ou épinards", image: "pasta/Tagliatelles con Pollo e Spinacci.webp" },
  { name: "Lasagne alla Bolognese", category: "pasta", price: 25, image: "pasta/Lasagne alla Bolognese.webp", featured: true },
  { name: "Penne Mare e Monti", category: "pasta", price: 28, description: "crevettes, champignons" },
  { name: "Penne Pesto et Crevettes", category: "pasta", price: 30, image: "pasta/Penne Pesto et Crevettes.webp" },
  { name: "Spaghettis al Frutti di Mare", category: "pasta", price: 33, image: "pasta/Spaghettis al Frutti di Mare.webp" },
  { name: "Paella", category: "pasta", price: 37, description: "pour 1 personne", image: "pasta/Paella.webp" },

  // ─── Plats ───────────────────────────────────────────────────────────────
  { name: "Xango", category: "plats", price: 22, description: "cordon bleu / poulet grillé, riz, salade, potatoes", image: "plats/Xango.webp" },
  { name: "Orchidée", category: "plats", price: 24, description: "suprême poulet, sauce champignons ou curry, riz", image: "plats/Orchidée.webp" },
  { name: "Cordon Bleu", category: "plats", price: 25, description: "riz, salade, potatoes", featured: true },
  { name: "Côte à l'Os", category: "plats", price: 36, description: "pâtes sauce tomate, légumes sautés, potatoes", image: "plats/Côte à l'Os.webp" },

  // ─── Chichas ─────────────────────────────────────────────────────────────
  // La carte liste une seule ligne à 9,00 DT couvrant 9 parfums : un plat unique
  // + un groupe d'options « Parfum » (choix unique, gratuit).
  {
    name: "Chicha",
    category: "chichas",
    price: 9,
    description: "Pomme, Menthe, Raisin, Pêche, Cerise, Chewing-Gum, Pastèque, Citron, Mojito",
    image: "chichas/chicha.webp",
    options: ["parfum-chicha"],
  },

  // ─── Boissons ────────────────────────────────────────────────────────────
  { name: "Eau Plate", category: "boissons", price: 3.5, image: "boissons/Eau Plate.webp" },
  { name: "Eau Gazeuse", category: "boissons", price: 4, image: "boissons/Eau Gazeuse.webp" },
  { name: "Sodas", category: "boissons", price: 4.5, image: "boissons/Sodas.webp" },
  { name: "Energy Drink", category: "boissons", price: 10, image: "boissons/Energy Drink.webp" },
];
