UPDATE payments SET metadata_new = metadata::jsonb WHERE metadata_new is null and metadata is not null;
ALTER TABLE payments RENAME COLUMN metadata TO metadata_old;
ALTER TABLE payments RENAME COLUMN metadata_new TO metadata;
