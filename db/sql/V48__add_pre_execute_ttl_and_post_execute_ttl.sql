ALTER TABLE gateway_methods ADD COLUMN pre_execute_ttl integer;
ALTER TABLE gateway_methods RENAME COLUMN payment_ttl TO post_execute_ttl;
