CREATE INDEX failed_ipns_client_payment_reference_index ON failed_ipns USING BTREE (client_payment_reference);
ALTER TABLE failed_ipns ALTER COLUMN payload TYPE JSONB USING payload::jsonb;