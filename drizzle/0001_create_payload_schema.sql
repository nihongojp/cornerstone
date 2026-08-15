-- Custom SQL migration file, put your code below! --

-- Payload owns the `payload` schema; drizzle-kit owns `public`. Payload's own
-- generated migrations are fully schema-qualified but never issue CREATE
-- SCHEMA, so the first `payload migrate` against a fresh database dies with
-- `schema "payload" does not exist`. Creating it here fixes the ordering:
-- drizzle migrations run first, then Payload's.
--
-- Nothing else about the `payload` schema is managed from drizzle. Note
-- `drizzle.config.ts` sets `schemaFilter: ['public']` so drizzle-kit never
-- diffs, and never proposes dropping, anything Payload owns.
CREATE SCHEMA IF NOT EXISTS "payload";
