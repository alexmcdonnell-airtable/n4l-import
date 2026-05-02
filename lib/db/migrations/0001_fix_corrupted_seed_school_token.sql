-- Repair the "Maple Grove Elementary" seed school whose stored
-- plaintext access_token did not hash to its access_token_hash, so
-- visiting /s/<token> returned "link is no longer valid".
--
-- Strategy: for every row whose access_token is missing or whose
-- sha256(access_token) does not equal access_token_hash, generate a
-- fresh random token in-database (via pgcrypto) and overwrite both
-- columns so they are mutually consistent. Each row gets its own
-- unique token, and no plaintext token is ever committed to source
-- control. After the migration, the admin can rotate any school's
-- token at will via POST /api/schools/:id/reset-token.
--
-- Idempotent: re-running this is a no-op once every row already
-- satisfies sha256(access_token) = access_token_hash.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "access_token" varchar;

DO $$
DECLARE
  r RECORD;
  new_token text;
BEGIN
  FOR r IN
    SELECT "id"
    FROM "schools"
    WHERE "access_token" IS NULL
       OR encode(digest("access_token", 'sha256'), 'hex') <> "access_token_hash"
  LOOP
    -- base64url-style token, 16 random bytes -> 22 chars, no padding.
    new_token := translate(
      encode(gen_random_bytes(16), 'base64'),
      '+/=',
      '-_'
    );
    UPDATE "schools"
    SET "access_token" = new_token,
        "access_token_hash" = encode(digest(new_token, 'sha256'), 'hex'),
        "token_last_reset_at" = now()
    WHERE "id" = r."id";
  END LOOP;
END $$;

ALTER TABLE "schools" ALTER COLUMN "access_token" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_access_token_unique'
  ) THEN
    ALTER TABLE "schools"
      ADD CONSTRAINT "schools_access_token_unique" UNIQUE ("access_token");
  END IF;
END $$;
