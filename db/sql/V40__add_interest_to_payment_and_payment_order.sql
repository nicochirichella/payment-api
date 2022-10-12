ALTER TABLE payments ADD COLUMN interest numeric(12,2) not null DEFAULT 0;
ALTER TABLE payment_orders ADD COLUMN interest numeric(12,2) not null DEFAULT 0;