CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  campus text,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT users_email_not_blank CHECK (btrim(email::text) <> ''),
  CONSTRAINT users_display_name_length CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  CONSTRAINT users_role_valid CHECK (role IN ('user', 'admin')),
  CONSTRAINT users_status_valid CHECK (status IN ('active', 'suspended'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip inet,
  user_agent text,
  CONSTRAINT sessions_token_hash_valid CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sessions_expiry_valid CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT one_time_tokens_purpose_valid CHECK (purpose IN ('verify_email', 'reset_password')),
  CONSTRAINT one_time_tokens_hash_valid CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT one_time_tokens_expiry_valid CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_key text UNIQUE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  suburb text,
  state text,
  postcode text,
  country_code char(2) NOT NULL DEFAULT 'AU',
  phone text,
  website_url text,
  latitude double precision,
  longitude double precision,
  cover_object_key text,
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  hours_text text,
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'admin',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT restaurants_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT restaurants_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT restaurants_status_valid CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT restaurants_location_pair CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (
      latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  )
);

-- Existing Railway databases predate restaurant cover images. Keep the schema
-- bootstrap idempotent while adding the column in place.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cover_object_key text;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_branch_identity_idx
  ON restaurants (lower(name), lower(COALESCE(address, '')))
  WHERE status <> 'archived';

CREATE TABLE IF NOT EXISTS restaurant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  spans_next_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_hours_day_valid CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT restaurant_hours_range_valid CHECK (
    (spans_next_day AND closes_at < opens_at)
    OR
    (NOT spans_next_day AND closes_at > opens_at)
  ),
  UNIQUE (restaurant_id, day_of_week, opens_at)
);

CREATE TABLE IF NOT EXISTS dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_key text UNIQUE,
  slug text NOT NULL UNIQUE,
  canonical_name text NOT NULL,
  cuisine text NOT NULL,
  dish_type text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'admin',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT dishes_name_length CHECK (char_length(btrim(canonical_name)) BETWEEN 1 AND 160),
  CONSTRAINT dishes_cuisine_not_blank CHECK (btrim(cuisine) <> ''),
  CONSTRAINT dishes_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT dishes_status_valid CHECK (status IN ('draft', 'published', 'archived')),
  UNIQUE (canonical_name, cuisine)
);

CREATE TABLE IF NOT EXISTS dish_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  alias citext NOT NULL,
  language_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dish_aliases_alias_not_blank CHECK (btrim(alias::text) <> ''),
  UNIQUE (dish_id, alias)
);

CREATE TABLE IF NOT EXISTS dish_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_key text UNIQUE,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  menu_name text,
  description text,
  listed_price numeric(10,2),
  currency char(3) NOT NULL DEFAULT 'AUD',
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'admin',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT dish_versions_menu_name_length CHECK (
    menu_name IS NULL OR char_length(btrim(menu_name)) BETWEEN 1 AND 180
  ),
  CONSTRAINT dish_versions_price_valid CHECK (listed_price IS NULL OR listed_price BETWEEN 0 AND 10000),
  CONSTRAINT dish_versions_currency_valid CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT dish_versions_status_valid CHECK (status IN ('draft', 'published', 'archived')),
  UNIQUE (dish_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name citext NOT NULL UNIQUE,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_not_blank CHECK (btrim(name::text) <> ''),
  CONSTRAINT tags_slug_not_blank CHECK (btrim(slug) <> '')
);

CREATE TABLE IF NOT EXISTS dish_version_tags (
  version_id uuid NOT NULL REFERENCES dish_versions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, tag_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_key text UNIQUE,
  version_id uuid NOT NULL REFERENCES dish_versions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name_snapshot text NOT NULL,
  would_eat_again boolean NOT NULL,
  body text,
  price_paid numeric(10,2),
  visited_on date,
  status text NOT NULL DEFAULT 'published',
  source text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_author_length CHECK (char_length(btrim(author_name_snapshot)) BETWEEN 1 AND 80),
  CONSTRAINT reviews_body_length CHECK (body IS NULL OR char_length(body) <= 4000),
  CONSTRAINT reviews_price_valid CHECK (price_paid IS NULL OR price_paid BETWEEN 0 AND 10000),
  CONSTRAINT reviews_status_valid CHECK (status IN ('published', 'hidden'))
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_user_version_idx
  ON reviews (version_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS version_rating_baselines (
  version_id uuid PRIMARY KEY REFERENCES dish_versions(id) ON DELETE CASCADE,
  yes_count integer NOT NULL DEFAULT 0,
  no_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'legacy_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT version_rating_baselines_yes_valid CHECK (yes_count >= 0),
  CONSTRAINT version_rating_baselines_no_valid CHECK (no_count >= 0)
);

CREATE TABLE IF NOT EXISTS saved_dishes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dish_id)
);

CREATE TABLE IF NOT EXISTS saved_versions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES dish_versions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version_id)
);

CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE RESTRICT,
  proposed_restaurant_name text,
  proposed_restaurant_address text,
  proposed_menu_name text,
  price_paid numeric(10,2),
  would_eat_again boolean,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  resulting_version_id uuid REFERENCES dish_versions(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contributions_restaurant_present CHECK (
    restaurant_id IS NOT NULL
    OR char_length(btrim(COALESCE(proposed_restaurant_name, ''))) > 0
  ),
  CONSTRAINT contributions_price_valid CHECK (price_paid IS NULL OR price_paid BETWEEN 0 AND 10000),
  CONSTRAINT contributions_notes_length CHECK (notes IS NULL OR char_length(notes) <= 4000),
  CONSTRAINT contributions_status_valid CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT contributions_review_state_valid CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND resulting_version_id IS NULL)
    OR
    (status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND resulting_version_id IS NOT NULL)
    OR
    (status = 'rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND resulting_version_id IS NULL)
  ),
  CONSTRAINT contributions_rejection_reason_valid CHECK (
    status <> 'rejected' OR char_length(btrim(COALESCE(rejection_reason, ''))) > 0
  )
);

-- Safe forward migration from the first draft where contribution and review
-- verdicts were coupled. Adding a Version no longer requires a review.
ALTER TABLE contributions ALTER COLUMN would_eat_again DROP NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  contribution_id uuid REFERENCES contributions(id) ON DELETE SET NULL,
  version_id uuid REFERENCES dish_versions(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_valid CHECK (
    type IN ('contribution_approved', 'contribution_rejected', 'system')
  ),
  CONSTRAINT notifications_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT notifications_body_not_blank CHECK (btrim(body) <> '')
);

CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_key text UNIQUE,
  object_key text NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  media_type text NOT NULL DEFAULT 'image',
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  mime_type text NOT NULL,
  original_filename text,
  byte_size bigint,
  width integer,
  height integer,
  checksum_sha256 text,
  r2_etag text,
  alt_text text,
  source text NOT NULL DEFAULT 'user',
  moderated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_object_key_not_blank CHECK (btrim(object_key) <> ''),
  CONSTRAINT media_type_valid CHECK (media_type IN ('image')),
  CONSTRAINT media_purpose_valid CHECK (purpose IN ('version', 'review', 'contribution', 'avatar')),
  CONSTRAINT media_status_valid CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  CONSTRAINT media_byte_size_valid CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 52428800),
  CONSTRAINT media_dimensions_valid CHECK (
    (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)
  ),
  CONSTRAINT media_checksum_valid CHECK (
    checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE IF NOT EXISTS version_media (
  version_id uuid NOT NULL REFERENCES dish_versions(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, media_id),
  CONSTRAINT version_media_sort_order_valid CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS version_media_one_cover_idx
  ON version_media (version_id)
  WHERE is_cover;

CREATE TABLE IF NOT EXISTS review_media (
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, media_id),
  CONSTRAINT review_media_sort_order_valid CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS contribution_media (
  contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, media_id),
  CONSTRAINT contribution_media_sort_order_valid CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_action_not_blank CHECK (btrim(action) <> ''),
  CONSTRAINT admin_audit_log_entity_not_blank CHECK (btrim(entity_type) <> '')
);

DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS restaurants_touch_updated_at ON restaurants;
CREATE TRIGGER restaurants_touch_updated_at BEFORE UPDATE ON restaurants
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS restaurant_hours_touch_updated_at ON restaurant_hours;
CREATE TRIGGER restaurant_hours_touch_updated_at BEFORE UPDATE ON restaurant_hours
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS dishes_touch_updated_at ON dishes;
CREATE TRIGGER dishes_touch_updated_at BEFORE UPDATE ON dishes
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS dish_versions_touch_updated_at ON dish_versions;
CREATE TRIGGER dish_versions_touch_updated_at BEFORE UPDATE ON dish_versions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS tags_touch_updated_at ON tags;
CREATE TRIGGER tags_touch_updated_at BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS reviews_touch_updated_at ON reviews;
CREATE TRIGGER reviews_touch_updated_at BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS contributions_touch_updated_at ON contributions;
CREATE TRIGGER contributions_touch_updated_at BEFORE UPDATE ON contributions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS media_touch_updated_at ON media;
CREATE TRIGGER media_touch_updated_at BEFORE UPDATE ON media
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx ON sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS sessions_active_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS one_time_tokens_user_purpose_idx ON one_time_tokens (user_id, purpose, expires_at DESC);
CREATE INDEX IF NOT EXISTS restaurants_status_idx ON restaurants (status);
CREATE INDEX IF NOT EXISTS restaurants_location_idx ON restaurants (latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS restaurants_name_trgm_idx ON restaurants USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dishes_status_idx ON dishes (status);
CREATE INDEX IF NOT EXISTS dishes_name_trgm_idx ON dishes USING gin (lower(canonical_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dish_aliases_alias_trgm_idx ON dish_aliases USING gin (lower(alias::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dish_versions_dish_status_idx ON dish_versions (dish_id, status);
CREATE INDEX IF NOT EXISTS dish_versions_restaurant_status_idx ON dish_versions (restaurant_id, status);
CREATE INDEX IF NOT EXISTS dish_versions_menu_name_trgm_idx ON dish_versions USING gin (lower(menu_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dish_version_tags_tag_idx ON dish_version_tags (tag_id, version_id);
CREATE INDEX IF NOT EXISTS reviews_version_status_created_idx ON reviews (version_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_user_created_idx ON reviews (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contributions_user_created_idx ON contributions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contributions_status_created_idx ON contributions (status, created_at ASC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS media_owner_created_idx ON media (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_status_purpose_idx ON media (status, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON admin_audit_log (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION distance_metres(
  latitude_a double precision,
  longitude_a double precision,
  latitude_b double precision,
  longitude_b double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT 6371000.0 * acos(
    LEAST(1.0, GREATEST(-1.0,
      sin(radians(latitude_a)) * sin(radians(latitude_b))
      + cos(radians(latitude_a)) * cos(radians(latitude_b))
      * cos(radians(longitude_b - longitude_a))
    ))
  );
$$;

CREATE OR REPLACE FUNCTION restaurant_is_open(
  requested_restaurant_id uuid,
  requested_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH venue_time AS (
    SELECT
      requested_at AT TIME ZONE r.timezone AS local_at
    FROM restaurants r
    WHERE r.id = requested_restaurant_id
  ), local_parts AS (
    SELECT
      extract(dow FROM local_at)::smallint AS local_day,
      local_at::time AS local_time
    FROM venue_time
  )
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_hours h
    CROSS JOIN local_parts p
    WHERE h.restaurant_id = requested_restaurant_id
      AND (
        (
          h.day_of_week = p.local_day
          AND (
            (NOT h.spans_next_day AND p.local_time >= h.opens_at AND p.local_time < h.closes_at)
            OR
            (h.spans_next_day AND p.local_time >= h.opens_at)
          )
        )
        OR
        (
          h.day_of_week = ((p.local_day + 6) % 7)
          AND h.spans_next_day
          AND p.local_time < h.closes_at
        )
      )
  );
$$;

CREATE OR REPLACE VIEW version_stats AS
WITH review_totals AS (
  SELECT
    version_id,
    count(*) FILTER (WHERE would_eat_again)::integer AS yes_count,
    count(*) FILTER (WHERE NOT would_eat_again)::integer AS no_count,
    avg(price_paid) FILTER (WHERE price_paid IS NOT NULL) AS average_price_paid
  FROM reviews
  WHERE status = 'published'
  GROUP BY version_id
), media_totals AS (
  SELECT
    vm.version_id,
    count(*)::integer AS gallery_count
  FROM version_media vm
  JOIN media m ON m.id = vm.media_id
  WHERE m.status = 'approved'
  GROUP BY vm.version_id
), combined AS (
  SELECT
    v.id AS version_id,
    COALESCE(b.yes_count, 0) + COALESCE(r.yes_count, 0) AS yes_votes,
    COALESCE(b.no_count, 0) + COALESCE(r.no_count, 0) AS no_votes,
    COALESCE(r.average_price_paid, v.listed_price) AS typical_price,
    COALESCE(m.gallery_count, 0) AS gallery_count
  FROM dish_versions v
  LEFT JOIN version_rating_baselines b ON b.version_id = v.id
  LEFT JOIN review_totals r ON r.version_id = v.id
  LEFT JOIN media_totals m ON m.version_id = v.id
)
SELECT
  version_id,
  yes_votes,
  no_votes,
  yes_votes + no_votes AS vote_count,
  CASE
    WHEN yes_votes + no_votes = 0 THEN NULL
    ELSE round(yes_votes * 100.0 / (yes_votes + no_votes))::integer
  END AS would_eat_again_percent,
  typical_price,
  gallery_count
FROM combined;

CREATE OR REPLACE VIEW dish_catalog_stats AS
SELECT
  d.id AS dish_id,
  count(v.id)::integer AS version_count,
  min(s.typical_price) AS minimum_price,
  max(s.would_eat_again_percent) AS best_would_eat_again_percent
FROM dishes d
LEFT JOIN dish_versions v
  ON v.dish_id = d.id
  AND v.status = 'published'
LEFT JOIN version_stats s ON s.version_id = v.id
GROUP BY d.id;

-- Compatibility name for code that models all image media as photos.
CREATE OR REPLACE VIEW photos AS
SELECT *
FROM media
WHERE media_type = 'image';

-- Review verdicts are a required product field. Fail a forward migration if
-- unexpected historical nulls exist instead of silently inventing a verdict.
ALTER TABLE reviews ALTER COLUMN would_eat_again SET NOT NULL;
