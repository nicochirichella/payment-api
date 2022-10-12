ALTER TABLE gateways ALTER COLUMN keys DROP NOT NULL;
UPDATE gateways SET keys_new = keys::jsonb WHERE keys_new is null and keys is not null;
ALTER TABLE gateways RENAME COLUMN keys TO keys_old;
ALTER TABLE gateways RENAME COLUMN keys_new TO keys;
