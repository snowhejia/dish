# Dish.

Dish. is an Expo / React Native app with a small self-hosted backend:

- iOS, Android and Web: Expo SDK 57 + Expo Router + TypeScript
- API and visual admin: Express + TypeScript
- Database: Railway PostgreSQL
- Food/review photos: Cloudflare R2
- Authentication: revocable opaque sessions (SecureStore in the mobile app, HttpOnly cookie in Admin)

The mobile UI keeps the bundled real-food dataset as an offline/demo fallback. When
`EXPO_PUBLIC_API_URL` is configured it loads the live Railway catalog and all user
writes go to PostgreSQL.

## Local checks

```bash
pnpm install
pnpm check
pnpm start
```

For a local API, copy `.env.example` to `.env`, point `DATABASE_URL` at PostgreSQL,
then run:

```bash
pnpm api:dev
```

The API is at `http://localhost:3000/api/v1` and the admin is at
`http://localhost:3000/admin`.

## Deploy the backend to Railway

1. Push this repository to GitHub and create a Railway project from the repository.
2. Add a PostgreSQL database to that Railway project.
3. In the app service, add a reference variable named `DATABASE_URL` pointing to the
   PostgreSQL service's `DATABASE_URL`.
4. Add the variables below. `railway.toml` already supplies the build, start and
   health-check commands.
5. Generate a public Railway domain. Open `https://<domain>/admin` and sign in with
   `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Required production variables:

```dotenv
NODE_ENV=production
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=use-a-long-unique-password
ADMIN_DISPLAY_NAME=Dish Admin
SESSION_TTL_DAYS=30

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=dish-media
R2_PUBLIC_URL=https://media.your-domain.com

SEED_ON_START=true
SEED_UPLOAD_MEDIA=true
SEED_MEDIA_OBJECT_PREFIX=seed/food
```

The first deployment creates the schema, imports the 20 supplied real-food records,
and uploads their photos to R2. Both operations are idempotent. After the first
successful deploy, set `SEED_ON_START=false` and `SEED_UPLOAD_MEDIA=false` so normal
deploys start faster.

Do not expose PostgreSQL publicly and never put `DATABASE_URL` or R2 credentials in
an `EXPO_PUBLIC_*` variable.

## Configure Cloudflare R2

1. Create a bucket (for example `dish-media`).
2. Create an R2 API token with Object Read & Write access limited to that bucket.
3. For production, attach a custom domain to the public bucket and use it as
   `R2_PUBLIC_URL`. The Cloudflare-managed `r2.dev` URL is suitable only for testing.
4. Put the account ID, access key, secret and bucket name in Railway variables.

The browser and mobile app never receive R2 credentials. Images are checked by the
Express upload endpoint and written to R2 with generated object keys.

## Point the app at Railway

Create `.env.local` for local Expo development:

```dotenv
EXPO_PUBLIC_API_URL=https://<your-service>.up.railway.app
```

Restart Expo after changing it. For a release build, set the same public variable in
the Expo/EAS build environment. User registration, login, Saved, reviews,
contributions, notifications and profile data will then use the Railway service.

## Admin capabilities

`/admin` is deliberately small and server-rendered. It includes:

- Dashboard counts and pending-work overview
- Restaurants, canonical Dishes and restaurant-specific Versions CRUD
- Photo upload to R2
- Contribution approval/rejection
- Review moderation
- User creation/status management

Canonical Dish and menu name are separate fields. This is what lets “Kani Miso
Ramen” and “Spicy Lamb Miso” remain two restaurant Versions of one `Miso Ramen`
Dish instead of becoming duplicate Dishes.
