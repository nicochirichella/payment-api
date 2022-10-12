ALTER TABLE items RENAME payment_id TO payment_order_id;
ALTER TABLE items DROP CONSTRAINT items_payment_id_fkey;
ALTER TABLE items ADD CONSTRAINT items_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES payment_orders MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE payments ADD CONSTRAINT payments_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES payment_orders MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE payments ALTER COLUMN payment_order_id SET NOT NULL;