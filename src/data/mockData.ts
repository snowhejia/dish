import { realFoodRecords, realVersionId } from './realData';

export type Dish = {
  id: string;
  name: string;
  cuisine: string;
  dishType?: string;
  description?: string;
};

export type DishVersion = {
  id: string;
  dishId: string;
  menuName?: string;
  restaurant: string;
  cuisine: string;
  dishType?: string;
  metres: number;
  distanceLabel?: string;
  price: number;
  wouldEatAgain: number;
  votes: number;
  tags: string[];
  mapX?: string;
  mapY?: number;
  address?: string;
  phone?: string | null;
  hours?: string;
  galleryCount?: number;
  imageUrl?: string;
  gallery?: string[];
  restaurantImageUrl?: string;
  restaurantId?: string;
  latitude?: number | null;
  longitude?: number | null;
  source?: 'prototype' | 'real' | 'admin';
};

export type Review = {
  id?: string;
  name: string;
  yes: boolean;
  text: string;
  pricePaid?: number | null;
  photoUrl?: string | null;
  createdAt?: string;
};

export type CatalogSnapshot = {
  dishes: Dish[];
  versions: DishVersion[];
  reviewsByVersion?: Record<string, Review[]>;
};

const prototypeDishes: Dish[] = [
  { id: 'beef', name: 'Beef Noodle Soup', cuisine: 'Chinese' },
  { id: 'banhmi', name: 'Banh Mi', cuisine: 'Vietnamese' },
  { id: 'katsu', name: 'Chicken Katsu Curry', cuisine: 'Japanese' },
  { id: 'dumpling', name: 'Pork Dumplings', cuisine: 'Chinese' },
  { id: 'wonton', name: 'Wonton Noodle Soup', cuisine: 'Chinese' },
  { id: 'katsudon', name: 'Pork Katsu Don', cuisine: 'Japanese' },
  { id: 'porkroll', name: 'Crispy Pork Roll', cuisine: 'Vietnamese' },
];

const prototypeVersions: DishVersion[] = [
  { id: 'beef-xian', dishId: 'beef', restaurant: "Xi'an Noodle House", cuisine: 'Chinese', metres: 820, price: 16.8, wouldEatAgain: 94, votes: 128, tags: ['Rich broth', 'Big portion', 'Hand-pulled', 'Chilli oil'], mapX: '58%', mapY: 300 },
  { id: 'beef-inn', dishId: 'beef', restaurant: 'Noodle Inn', cuisine: 'Chinese', metres: 1100, price: 15.5, wouldEatAgain: 90, votes: 86, tags: ['Clear broth', 'Tender beef', 'Quick'], mapX: '26%', mapY: 205 },
  { id: 'beef-lanzhou', dishId: 'beef', restaurant: 'Little Lanzhou', cuisine: 'Chinese', metres: 1400, price: 18, wouldEatAgain: 88, votes: 64, tags: ['Spicy', 'Thin noodles'], mapX: '76%', mapY: 470 },
  { id: 'beef-golden', dishId: 'beef', restaurant: 'Golden Bowl', cuisine: 'Chinese', metres: 600, price: 14.9, wouldEatAgain: 76, votes: 41, tags: ['Cheap', 'Small portion'], mapX: '38%', mapY: 560 },
  { id: 'banhmi-saigon', dishId: 'banhmi', restaurant: 'Saigon Corner', cuisine: 'Vietnamese', metres: 450, price: 12.5, wouldEatAgain: 96, votes: 210, tags: ['Crusty roll', 'Loaded', 'Fast'] },
  { id: 'banhmi-haiba', dishId: 'banhmi', restaurant: 'Hai Ba Deli', cuisine: 'Vietnamese', metres: 900, price: 13, wouldEatAgain: 89, votes: 77, tags: ['Pork belly', 'Pickles'] },
  { id: 'katsu-kagawa', dishId: 'katsu', restaurant: 'Kagawa Kitchen', cuisine: 'Japanese', metres: 700, price: 18.5, wouldEatAgain: 92, votes: 154, tags: ['Crispy', 'Mild curry', 'Filling'] },
  { id: 'katsu-lab', dishId: 'katsu', restaurant: 'Curry Lab', cuisine: 'Japanese', metres: 1200, price: 17, wouldEatAgain: 81, votes: 58, tags: ['Thick sauce', 'Fast'] },
  { id: 'dumpling-xian', dishId: 'dumpling', restaurant: "Xi'an Noodle House", cuisine: 'Chinese', metres: 820, price: 13.8, wouldEatAgain: 85, votes: 96, tags: ['Juicy', 'Thin skin'] },
  { id: 'wonton-alley', dishId: 'wonton', restaurant: 'Dumpling Alley', cuisine: 'Chinese', metres: 300, price: 15.2, wouldEatAgain: 91, votes: 143, tags: ['Silky wontons', 'Light broth'] },
  { id: 'wonton-inn', dishId: 'wonton', restaurant: 'Noodle Inn', cuisine: 'Chinese', metres: 1100, price: 14.8, wouldEatAgain: 83, votes: 61, tags: ['Big bowl', 'Mild'] },
  { id: 'katsudon-kagawa', dishId: 'katsudon', restaurant: 'Kagawa Kitchen', cuisine: 'Japanese', metres: 700, price: 16.5, wouldEatAgain: 90, votes: 72, tags: ['Runny egg', 'Comfort'] },
  { id: 'katsudon-ricebar', dishId: 'katsudon', restaurant: 'Rice Bar', cuisine: 'Japanese', metres: 520, price: 15.9, wouldEatAgain: 84, votes: 49, tags: ['Generous rice', 'Cheap'] },
  { id: 'porkroll-marrick', dishId: 'porkroll', restaurant: 'Marrickville Pork Roll', cuisine: 'Vietnamese', metres: 640, price: 11.5, wouldEatAgain: 95, votes: 186, tags: ['Crackling', 'Value', 'Takeaway'] },
  { id: 'porkroll-bakehouse', dishId: 'porkroll', restaurant: 'Newtown Bakehouse', cuisine: 'Vietnamese', metres: 1250, price: 13.5, wouldEatAgain: 82, votes: 54, tags: ['Soft roll', 'Mild'] },
];

export const realDishes: Dish[] = Array.from(new Map(
  realFoodRecords.map((record) => [
    record.canonicalDishId,
    {
      id: record.canonicalDishId,
      name: record.canonicalDishName,
      cuisine: record.cuisine,
      dishType: record.dishType,
    },
  ]),
).values());

export const realVersions: DishVersion[] = realFoodRecords.map((record) => ({
  id: realVersionId(record.id),
  dishId: record.canonicalDishId,
  menuName: record.name,
  restaurant: record.restaurant,
  cuisine: record.cuisine,
  dishType: record.dishType,
  metres: 0,
  distanceLabel: record.area,
  price: record.price,
  wouldEatAgain: 100,
  votes: 1,
  tags: [...record.tags],
  address: record.address,
  phone: record.phone,
  hours: record.hours,
  latitude: record.latitude,
  longitude: record.longitude,
  galleryCount: 1,
  source: 'real',
}));

// Real records lead browse surfaces, while the original prototype data remains
// available for its multi-version comparison and saved-item flows.
export const dishes: Dish[] = [...realDishes, ...prototypeDishes];
export const versions: DishVersion[] = [...realVersions, ...prototypeVersions];

const prototypeReviewsByVersion: Record<string, Review[]> = {
  'beef-xian': [
    { name: 'Jessica', yes: true, text: 'Broth is rich without being heavy and the noodles are properly chewy. Worth the walk.' },
    { name: 'Ethan', yes: false, text: 'A little salty for me and the queue at lunch was 20 minutes.' },
  ],
  'banhmi-saigon': [
    { name: 'Tom', yes: true, text: 'Roll is still warm and crackly. Best value near campus.' },
    { name: 'Priya', yes: true, text: 'Ask for extra chilli. Ready in two minutes.' },
  ],
};

const realReviewsByVersion: Record<string, Review[]> = Object.fromEntries(
  realFoodRecords.map((record) => [
    realVersionId(record.id),
    [{ name: record.author, yes: true, text: record.recommendation }],
  ]),
);

export const reviewsByVersion: Record<string, Review[]> = {
  ...realReviewsByVersion,
  ...prototypeReviewsByVersion,
};

export const dishById = (id?: string) => dishes.find((dish) => dish.id === id);
export const versionById = (id?: string) => versions.find((version) => version.id === id);
export const versionsOfDish = (dishId?: string) => dishId
  ? versions.filter((version) => version.dishId === dishId)
  : [];
export const dishForVersion = (version: DishVersion) => dishById(version.dishId);
export const versionMenuName = (version: DishVersion) => version.menuName ?? dishForVersion(version)?.name ?? 'Dish';

export const money = (price: number) => `$${price.toFixed(2)}`;
export const distance = (metres: number) => metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
export const versionDistance = (version: DishVersion) => version.distanceLabel
  ?? (version.metres > 0 ? distance(version.metres) : 'Distance not listed');
export const versionAvailability = (version: DishVersion) => version.hours ? 'Hours listed' : 'Hours not listed';

export const restaurants = Array.from(new Set(versions.map((version) => version.restaurant)));

/**
 * Installs a server snapshot without replacing the exported array identities.
 * Existing screens can keep the bundled demo dataset as an offline fallback,
 * while CatalogProvider triggers a render when a Railway response arrives.
 */
export function installCatalogSnapshot(snapshot: CatalogSnapshot) {
  dishes.splice(0, dishes.length, ...snapshot.dishes);
  versions.splice(0, versions.length, ...snapshot.versions);
  restaurants.splice(0, restaurants.length, ...Array.from(new Set(snapshot.versions.map((version) => version.restaurant))));

  Object.keys(reviewsByVersion).forEach((key) => delete reviewsByVersion[key]);
  if (snapshot.reviewsByVersion) {
    Object.assign(reviewsByVersion, snapshot.reviewsByVersion);
  }
}
