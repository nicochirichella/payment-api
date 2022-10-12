ALTER TABLE gateway_methods ADD COLUMN payment_ttl integer not null DEFAULT 2880;
ALTER TABLE payments ADD COLUMN expiration_date timestamp;