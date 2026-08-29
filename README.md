<p align="center">
  <img src="./assets/images/app-icon-dish.png" alt="Dish. app icon" width="120" />
</p>

<h1 align="center">Dish.</h1>

<p align="center">
  <strong>Find the dish you want—then decide where to eat it.</strong>
</p>

<p align="center">
  Built for SYNCS HACK 2026 · <em>Blocks That Make Up the World</em>
</p>

## The idea

Most food discovery platforms treat the restaurant as their basic unit. But every
restaurant is made of smaller building blocks: its individual dishes. A single
restaurant rating cannot tell you which bowl of ramen, banh mi or curry is actually
worth ordering. Dish. shifts discovery down one level and makes the dish the primary
block.

Those blocks are interconnected, not isolated. One dish can connect several
restaurant-specific versions, while different dishes connect through shared
restaurants, cuisines, locations and the people who review them. Dish. makes those
relationships explorable, turning scattered menu items into shared local food
knowledge.

## Features

- Discover nearby food through a photo-first feed
- Search and filter dishes and restaurants
- Compare different versions of the same dish
- Explore nearby options on a map and get directions
- Save either a dish or one specific restaurant version
- Share Yes / No reviews, photos and prices
- Contribute new dish versions to the community

## Tech stack

- Expo SDK 57, React Native, Expo Router and TypeScript
- Express and PostgreSQL
- Cloudflare R2 for media storage
- React Native Maps

## Run locally

Requires Node.js and pnpm.

```bash
pnpm install
pnpm start
```

The app includes a bundled sample catalog, so the main experience can be explored
without configuring the backend.

Run the project checks with:

```bash
pnpm run check
```
