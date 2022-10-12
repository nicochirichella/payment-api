ALTER TABLE incoming_ipns ADD COLUMN payload_new jsonb;
ALTER TABLE gateways ADD COLUMN keys_new jsonb;
ALTER TABLE items ADD COLUMN details_new jsonb;
ALTER TABLE payment_orders ADD COLUMN metadata_new jsonb;
ALTER TABLE payments ADD COLUMN metadata_new jsonb;
