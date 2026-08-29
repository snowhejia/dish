<p align="center">
  <img src="./assets/images/app-icon-dish.png" alt="Dish. app icon" width="120" />
</p>

<h1 align="center">Dish.</h1>

<p align="center">
  <strong>Find the dish you want—then decide where to eat it.</strong>
</p>

Dish. is a cross-platform food discovery app built around dishes, not just
restaurants. It brings together restaurant-specific versions of the same dish so
people can compare nearby options and choose what to eat with confidence.

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
