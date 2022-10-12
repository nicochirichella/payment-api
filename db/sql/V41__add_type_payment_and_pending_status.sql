CREATE TYPE payment_type AS ENUM ('ticket','creditCard');
ALTER TABLE payments ADD COLUMN type payment_type NULL;
UPDATE payments SET type = 'creditCard';
ALTER TABLE payments ALTER type SET NOT NULL;
INSERT INTO payment_statuses (id, description) VALUES ('pendingClientAction', '');