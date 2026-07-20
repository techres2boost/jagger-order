// Données menu BOX — transcrites strictement d'après la fiche fournie.
// Aucun prix, nom ou description n'est inventé.
// Les éléments incertains sont marqués `// À COMPLÉTER`.

export type Category =
  "burgers" | "formules" | "viande" | "pates" | "boissons" | "pizzas" | "sandwichs" | "entrees";

// URL raw des photos hébergées sur GitHub
const GH = "https://raw.githubusercontent.com/khadijabenjaafar/la-roja/main.c/box";

export interface PriceOption {
  label: string;
  price: number;
}

export interface RemovableOption {
  id: string;
  label: string;
}

export interface MenuItem {
  id: string;
  category: Category;
  name: string;
  description?: string;
  image?: string;
  populaire?: boolean;
  // Prix simple OU plusieurs formats (pizza/sandwich)
  price?: number;
  sizes?: PriceOption[];
  // Suppléments applicables (pour les pizzas uniquement dans la fiche)
  supplementsGroup?: "pizza";
  incomplete?: boolean; // signale un item avec info manquante
  // Composition de base (texte descriptif, non sélectionnable)
  composition?: string;
  // Options retirables (cochées par défaut, décocher = retirer)
  removableOptions?: RemovableOption[];
}

export const supplementsPizza: PriceOption[] = [
  { label: "Thon", price: 2.0 },
  { label: "Jambon", price: 2.0 },
  { label: "Champignon", price: 2.0 },
  { label: "Mozzarella", price: 2.0 },
  { label: "Roquefort", price: 2.0 },
  { label: "Bord farcie", price: 2.5 },
];

// ─── OPTIONS RETIRABLES GLOBALES ─────────────────────────────────────
export const STANDARD_REMOVABLE: RemovableOption[] = [
  { id: "mayo", label: "Mayonnaise" },
  { id: "harissa", label: "Harissa" },
  { id: "bbq", label: "Sauce barbecue" },
  { id: "ketchup", label: "Ketchup" },
  { id: "oignons", label: "Oignons" },
  { id: "oignons_caramelises", label: "Oignons caramélisés" },
];

export const SALAD_REMOVABLE: RemovableOption[] = [
  ...STANDARD_REMOVABLE,
  { id: "huile_olive", label: "Huile d'olive" },
];

export const MECHWIA_REMOVABLE: RemovableOption[] = [
  { id: "harissa", label: "Harissa" },
  { id: "huile_olive", label: "Huile d'olive" },
];

// Compositions de base pour les burgers
const BURGER_COMPOSITIONS: Record<string, string> = {
  "b-hamburger": "Viande hachée, laitue, tomates + frites",
  "b-cheese": "Viande hachée, fromage, laitue, tomates + frites",
  "b-one": "Poulet pané, laitue, tomates + frites",
  "b-double": "2 poulet pané, laitue, tomates + frites",
  "b-triple": "3 viande hachée, laitue, tomates + frites",
};

// ─── BURGERS ─────────────────────────────────────────────────────────
// Photos confirmées pour Hamburger, Cheese Burger, Big Cheese (et Menu 1), Triple.
// Les fichiers Chicken (Chicken/BigChicken/CheeseChicken/TripleChicken) existent
// sur GitHub mais leur correspondance exacte avec un item du menu n'est pas
// confirmée — laissés sans image jusqu'à validation.
// À CONFIRMER — correspondance avec le menu à valider pour :
//   ChickenBurger.png, BigChickenBurger.png, CheeseChickenBurger.png,
//   TripleChickenBurger.jfif
const burgers: MenuItem[] = [
  {
    id: "b-hamburger",
    category: "burgers",
    name: "Hamburger",
    price: 3.4,
    image: `${GH}/burgers/Hamburger.png`,
  },
  {
    id: "b-cheese",
    category: "burgers",
    name: "Cheese Burger",
    price: 3.9,
    image: `${GH}/burgers/CheeseBurger.png`,
  },
  { id: "b-one", category: "burgers", name: "One", price: 3.9, image: `${GH}/burgers/one.png` },
  {
    id: "b-double",
    category: "burgers",
    name: "Double",
    price: 5.4,
    image: `${GH}/burgers/double.png`,
  },
  {
    id: "b-triple",
    category: "burgers",
    name: "Triple",
    price: 7.8,
    image: `${GH}/burgers/TripleBurger.png`,
  },
  {
    id: "b-bigcheese",
    category: "burgers",
    name: "Big Cheese",
    price: 4.7,
    populaire: true,
    image: `${GH}/burgers/BigCheeseBurger.png`,
  },
  {
    id: "b-tower",
    category: "burgers",
    name: "Tower",
    description: "Jambon, escalope panée, hamburger",
    price: 6.9,
    image: `${GH}/burgers/tower.jpg`,
  },
  {
    id: "b-crispy",
    category: "burgers",
    name: "Crispy",
    price: 6.3,
    image: `${GH}/burgers/crispy.png`,
  },
  // À COMPLÉTER : "Big Chicken Burger" a été indiqué comme populaire par le client,
  // mais il n'apparaît pas dans la carte fournie. À confirmer avant intégration.
];

// ─── FORMULES ────────────────────────────────────────────────────────
const menus: MenuItem[] = [
  {
    id: "m-menu1",
    category: "formules",
    name: "Formule 1",
    description: "Big Cheese, frites, boisson",
    price: 6.0,
    image: `${GH}/burgers/BigCheeseBurger.png`,
  },
  {
    id: "m-menu2",
    category: "formules",
    name: "Formule 2",
    description: "Cheese Burger, frites, boisson, coupe de glace",
    price: 7.5,
    image: `${GH}/burgers/menu2.png`,
  },
  {
    id: "m-menu3",
    category: "formules",
    name: "Formule 3",
    description: "Panini thon, salade variée, soupe, eau 0.5L",
    price: 9.0,
    image: `${GH}/burgers/menu3.png`,
  },
  {
    id: "m-menu4",
    category: "formules",
    name: "Formule 4",
    description: "Salade niçoise, brik au thon, soupe, eau 0.5L",
    price: 9.0,
    image: `${GH}/burgers/menu4.png`,
  },
];

// ─── VIANDE ──────────────────────────────────────────────────────────
const viande: MenuItem[] = [
  {
    id: "v-masterpeace",
    category: "viande",
    name: "Master Peace",
    description: "Steak, foie, frites",
    price: 8.4,
    image: `${GH}/entree/masterPeace.png`,
  },
  {
    id: "v-master",
    category: "viande",
    name: "Master",
    description: "Steak, frites, mayonnaise, ketchup",
    price: 5.3,
    image: `${GH}/entree/Master.png`,
  },
];

// ─── PÂTES ───────────────────────────────────────────────────────────
const pates: MenuItem[] = [
  {
    id: "pa-lasagne-bolo",
    category: "pates",
    name: "Lasagne Bolognaise",
    price: 7.2,
    image: `${GH}/entree/lasagneBolonaise.png`,
  },
  {
    id: "pa-lasagne-mer",
    category: "pates",
    name: "Lasagne Fruits de Mer",
    price: 9.3,
    image: `${GH}/entree/lasagneFruitDemer.png`,
  },
];

// ─── BOISSONS ────────────────────────────────────────────────────────
// Noms et prix confirmés par le client + photos GitHub dispos.
const boissons: MenuItem[] = [
  {
    id: "d-eau15",
    category: "boissons",
    name: "Eau minérale 1.5L",
    price: 2.0,
    image: `${GH}/Boisson/eau.png`,
  },
  {
    id: "d-eau05",
    category: "boissons",
    name: "Eau minérale 0.5L",
    price: 1.5,
    image: `${GH}/Boisson/eau.png`,
  },
  {
    id: "d-garci",
    category: "boissons",
    name: "Eau Garci",
    price: 1.0,
    image: `${GH}/Boisson/eauGarci.png`,
  },
  {
    id: "d-coca",
    category: "boissons",
    name: "Coca-Cola",
    price: 3.0,
    image: `${GH}/Boisson/cocacola.png` /* À COMPLÉTER : format (33cl/50cl/1.5L) non précisé */,
  },
  {
    id: "d-cocazero",
    category: "boissons",
    name: "Coca-Cola Zéro",
    price: 3.0,
    image: `${GH}/Boisson/cocacolaZero.png`,
  },
  {
    id: "d-fanta-orange",
    category: "boissons",
    name: "Fanta Orange",
    price: 3.0,
    image: `${GH}/Boisson/FantaOrange.png`,
  },
  {
    id: "d-fanta-citron",
    category: "boissons",
    name: "Fanta Citron",
    price: 3.0,
    image: `${GH}/Boisson/fantaCitron.png`,
  },
  {
    id: "d-boga-lime",
    category: "boissons",
    name: "Boga Lime",
    price: 3.0,
    image: `${GH}/Boisson/BogoLim.png`,
  },
  {
    id: "d-boga-cidre",
    category: "boissons",
    name: "Boga Cidre",
    price: 3.0,
    image: `${GH}/Boisson/bogaCidre.png`,
  },
  {
    id: "d-hawai",
    category: "boissons",
    name: "Hawaï",
    price: 3.0,
    image: `${GH}/Boisson/hawai.png`,
  },
  // Noms et prix confirmés par le client + photos GitHub dispos.
  {
    id: "d-jus-milkshake",
    category: "boissons",
    name: "Jus",
    price: 2.0,
    image: `${GH}/Boisson/jus.png`,
  },
  {
    id: "d-shark",
    category: "boissons",
    name: "Shark energy drink",
    price: 4.0,
    image: `${GH}/Boisson/shark.png`,
  },
  {
    id: "d-thecafe",
    category: "boissons",
    name: "Thé / Café",
    price: 2.0,
    image: `${GH}/Boisson/CafeThe.png`,
  },
  {
    id: "d-jus",
    category: "boissons",
    name: "Citronnade",
    price: 1.5,
    image: `${GH}/Boisson/citronnade.png`,
  },
];

// ─── PIZZAS ──────────────────────────────────────────────────────────
type PizzaPrices = [number, number, number, number]; // Moy R, Moy B, Maxi R, Maxi B
function pizzaSizes([mr, mb, xr, xb]: PizzaPrices): PriceOption[] {
  return [
    { label: "Moyenne Rouge", price: mr },
    { label: "Moyenne Blanche", price: mb },
    { label: "Maxi Rouge", price: xr },
    { label: "Maxi Blanche", price: xb },
  ];
}

const pizzas: MenuItem[] = [
  {
    id: "p-margherita",
    category: "pizzas",
    name: "Margherita",
    description: "Tomates fraîches, mozzarella, basilic",
    sizes: pizzaSizes([5, 5.7, 6.4, 7.4]),
    image: `${GH}/pizza/margerita.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-napolitana",
    category: "pizzas",
    name: "Napolitana",
    description: "Tomates fraîches, mozzarella, anchois, câpres, olives",
    sizes: pizzaSizes([5.5, 6.1, 7.4, 8.4]),
    image: `${GH}/pizza/Napolitano.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-vege",
    category: "pizzas",
    name: "Végétarienne",
    description: "Tomates fraîches, mozzarella, basilic, légumes grillés, olives",
    sizes: pizzaSizes([5.5, 6.1, 7.4, 8.4]),
    image: `${GH}/pizza/vegeterienne.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-jambon",
    category: "pizzas",
    name: "Jambon",
    description: "Tomates fraîches, mozzarella, basilic, jambons, olives",
    sizes: pizzaSizes([5.9, 6.6, 8.4, 9.4]),
    image: `${GH}/pizza/jambon.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-neptune",
    category: "pizzas",
    name: "Neptune",
    description: "Tomates fraîches, mozzarella, basilic, thon, olives",
    sizes: pizzaSizes([5.9, 6.6, 8.4, 9.4]),
    image: `${GH}/pizza/neptune.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-champi",
    category: "pizzas",
    name: "Champignons",
    description: "Tomates fraîches, mozzarella, basilic, champignons, olives",
    sizes: pizzaSizes([5.9, 6.6, 8.4, 9.4]),
    image: `${GH}/pizza/Champignon.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-bronx",
    category: "pizzas",
    name: "Bronx",
    description:
      "Tomates fraîches, mozzarella, basilic, champignons, rondelles de tomates, poivrons, olives",
    sizes: pizzaSizes([7.3, 7.9, 9.4, 9.9]),
    image: `${GH}/pizza/Bronx.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-tunisienne",
    category: "pizzas",
    name: "Tunisienne",
    description: "Tomates fraîches, mozzarella, basilic, merguez, œuf, olives",
    sizes: pizzaSizes([7.5, 8, 9.9, 10.8]),
    image: `${GH}/pizza/tunisienne.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-regina",
    category: "pizzas",
    name: "Régina",
    description: "Tomates fraîches, mozzarella, basilic, champignons, jambons, olives",
    sizes: pizzaSizes([6.9, 7.3, 9.4, 9.9]),
    image: `${GH}/pizza/Regina.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-4saisons",
    category: "pizzas",
    name: "4 Saisons",
    description:
      "Tomates fraîches, mozzarella, basilic, légumes grillés, champignons, jambons, olives",
    sizes: pizzaSizes([7.5, 8, 9.5, 10.6]),
    image: `${GH}/pizza/4saisons.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-4fromages",
    category: "pizzas",
    name: "4 Fromages",
    description: "Tomates fraîches, mozzarella, basilic, roquefort, gruyère, edam",
    sizes: pizzaSizes([8, 8.6, 9.9, 10.9]),
    image: `${GH}/pizza/4fromage.png`,
    supplementsGroup: "pizza",
  },
  {
    id: "p-mexicaine",
    category: "pizzas",
    name: "Mexicaine",
    description: "Tomates fraîches, mozzarella, basilic, viandes hachées, légumes grillés, olives",
    sizes: pizzaSizes([9.5, 10, 11.5, 12.5]),
    image: `${GH}/pizza/mexicaine.png`,
    supplementsGroup: "pizza",
    populaire: true,
  },
  {
    id: "p-box",
    category: "pizzas",
    name: "Box",
    description: "Tomates fraîches, mozzarella, basilic, fruits de mer, olives",
    sizes: pizzaSizes([9.5, 10, 12, 12.9]),
    image: `${GH}/pizza/box.png`,
    supplementsGroup: "pizza",
  },
];

// ─── SANDWICHS ───────────────────────────────────────────────────────
type SwPrices = [number, number, number | null]; // Simple / 2en1 / Ma9loub-Cornet
function swSizes([s, d, m]: SwPrices): PriceOption[] {
  const arr: PriceOption[] = [
    { label: "Simple", price: s },
    { label: "2 en 1", price: d },
  ];
  if (m !== null) arr.push({ label: "Ma9loub / Cornet", price: m });
  return arr;
}
const sandwichs: MenuItem[] = [
  {
    id: "s-thon",
    category: "sandwichs",
    name: "Thon",
    sizes: swSizes([2.5, 3, null]),
    image: `${GH}/sandwich/thon.png`,
  },
  {
    id: "s-fromage",
    category: "sandwichs",
    name: "Fromage",
    sizes: swSizes([2.2, 2.8, null]),
    image: `${GH}/sandwich/fromage.png`,
  },
  {
    id: "s-jambon",
    category: "sandwichs",
    name: "Jambon",
    sizes: swSizes([2.5, 3, null]),
    image: `${GH}/sandwich/jambon.png`,
  },
  {
    id: "s-thon-frites",
    category: "sandwichs",
    name: "Thon + frites",
    sizes: swSizes([3.3, 3.8, 4.5]),
    image: `${GH}/sandwich/thon.png`,
  },
  {
    id: "s-fromage-frites",
    category: "sandwichs",
    name: "Fromage + frites",
    sizes: swSizes([3, 3.5, 4.3]),
    image: `${GH}/sandwich/fromage.png`,
  },
  {
    id: "s-jambon-frites",
    category: "sandwichs",
    name: "Jambon + frites",
    sizes: swSizes([3.3, 3.8, 4.5]),
    image: `${GH}/sandwich/jambon.png`,
  },
  // Une seule image "escalope.png" — réutilisée pour grillée et panée
  {
    id: "s-esc-grillee",
    category: "sandwichs",
    name: "Escalope de poulet grillée",
    sizes: swSizes([3.5, 3.9, 4.7]),
    image: `${GH}/sandwich/escalope.png`,
  },
  {
    id: "s-esc-panee",
    category: "sandwichs",
    name: "Escalope de poulet panée",
    sizes: swSizes([3.9, 4.3, 4.9]),
    image: `${GH}/sandwich/escalope.png`,
  },
  {
    id: "s-chawarma",
    category: "sandwichs",
    name: "Chawarma",
    sizes: swSizes([3.5, 3.9, 4.7]),
    image: `${GH}/sandwich/chawarma.png`,
  },
  {
    id: "s-steak",
    category: "sandwichs",
    name: "Steak haché",
    sizes: swSizes([3.4, 3.9, 4.7]),
    image: `${GH}/sandwich/steak.png`,
    populaire: true,
  },
  {
    id: "s-foie",
    category: "sandwichs",
    name: "Foie",
    sizes: swSizes([4.3, 4.9, 5.5]),
    image: `${GH}/sandwich/foie.png`,
  },
  {
    id: "s-merguez",
    category: "sandwichs",
    name: "Merguez",
    sizes: swSizes([3.9, 4.7, 5.3]),
    image: `${GH}/sandwich/mergez.png`,
  },
  {
    id: "s-nuggets",
    category: "sandwichs",
    name: "Nuggets",
    sizes: swSizes([3.6, 4.2, 4.8]),
    image: `${GH}/sandwich/nugets.png`,
  },
  // À COMPLÉTER : "Cordon Bleu" a été indiqué comme populaire par le client
  // mais n'apparaît pas dans la carte fournie. À confirmer avant intégration.
];

// ─── ENTRÉES ─────────────────────────────────────────────────────────
// À COMPLÉTER — photo réelle à uploader pour : Soupe.
// brik.jpg : image générique — assignée aux deux briks (thon + fruits de mer).
const entrees: MenuItem[] = [
  {
    id: "e-nicoise",
    category: "entrees",
    name: "Salade niçoise",
    price: 4.5,
    image: `${GH}/entree/nicoise.png`,
  },
  {
    id: "e-mer",
    category: "entrees",
    name: "Salade fruits de mer",
    price: 7.2,
    image: `${GH}/entree/fruitdemer.png`,
  },
  {
    id: "e-variee",
    category: "entrees",
    name: "Salade variée",
    price: 3.8,
    image: `${GH}/entree/salade%20variee.png`,
  },
  {
    id: "e-mechwia",
    category: "entrees",
    name: "Salade mechwia",
    price: 3.8,
    image: `${GH}/entree/mechwia.png`,
  },
  {
    id: "e-tomates-mozza",
    category: "entrees",
    name: "Salade tomates mozzarella",
    price: 5.5,
    image: `${GH}/entree/tomatemozza.png`,
  },
  {
    id: "e-roquefort",
    category: "entrees",
    name: "Salade roquefort",
    price: 5.7,
    image: `${GH}/entree/roquefort.png`,
  },
  {
    id: "e-cesar",
    category: "entrees",
    name: "Salade César à l'escalope",
    price: 6.8,
    image: `${GH}/entree/cesar.png`,
  },
  {
    id: "e-jambon",
    category: "entrees",
    name: "Salade jambon",
    price: 3.8,
    image: `${GH}/entree/saladejambon.jpg`,
  },
  {
    id: "e-soupe",
    category: "entrees",
    name: "Soupe",
    price: 2.0,
    image: `${GH}/entree/soupe.png`,
  },
  {
    id: "e-om-thon",
    category: "entrees",
    name: "Omelette au thon",
    price: 3.8,
    image: `${GH}/entree/omletthon.jpg`,
  },
  {
    id: "e-om-champi",
    category: "entrees",
    name: "Omelette aux champignons",
    price: 3.8,
    image: `${GH}/entree/omletchamp.jpg`,
  },
  {
    id: "e-brik-mer",
    category: "entrees",
    name: "Brik aux fruits de mer",
    price: 3.0,
    image: `${GH}/entree/brik.jpg`,
  },
  {
    id: "e-brik-thon",
    category: "entrees",
    name: "Brik au thon",
    price: 2.0,
    image: `${GH}/entree/brik.jpg`,
  },
];

export const MENU: MenuItem[] = [
  ...burgers,
  ...menus,
  ...viande,
  ...pates,
  ...pizzas,
  ...sandwichs,
  ...boissons,
  ...entrees,
];

// Application des options retirables et compositions
const SALAD_IDS = new Set([
  "e-nicoise",
  "e-mer",
  "e-variee",
  "e-tomates-mozza",
  "e-roquefort",
  "e-cesar",
  "e-jambon",
]);

for (const item of MENU) {
  if (BURGER_COMPOSITIONS[item.id]) {
    item.composition = BURGER_COMPOSITIONS[item.id];
  }
  if (
    item.category === "burgers" ||
    item.category === "formules" ||
    item.category === "sandwichs"
  ) {
    item.removableOptions = STANDARD_REMOVABLE;
  } else if (item.id === "e-mechwia") {
    item.removableOptions = MECHWIA_REMOVABLE;
  } else if (SALAD_IDS.has(item.id)) {
    item.removableOptions = SALAD_REMOVABLE;
  }
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "formules", label: "Formules" },
  { id: "burgers", label: "Burgers" },
  { id: "viande", label: "Viande" },
  { id: "pates", label: "Pâtes" },
  { id: "pizzas", label: "Pizzas" },
  { id: "sandwichs", label: "Sandwichs" },
  { id: "boissons", label: "Boissons" },
  { id: "entrees", label: "Entrées" },
];

export const POPULAIRES = MENU.filter((i) => i.populaire);
