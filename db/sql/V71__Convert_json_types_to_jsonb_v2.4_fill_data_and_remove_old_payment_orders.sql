UPDATE payment_orders SET metadata_new = metadata::jsonb WHERE metadata_new is null and metadata is not null;
ALTER TABLE payment_orders RENAME COLUMN metadata TO metadata_old;
ALTER TABLE payment_orders RENAME COLUMN metadata_new TO metadata;
