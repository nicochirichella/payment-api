ALTER TABLE incoming_ipns ALTER COLUMN payload DROP NOT NULL;
UPDATE incoming_ipns SET payload_new = payload::jsonb WHERE payload_new is null and payload is not null;
ALTER TABLE incoming_ipns RENAME COLUMN payload TO payload_old;
ALTER TABLE incoming_ipns RENAME COLUMN payload_new TO payload;
