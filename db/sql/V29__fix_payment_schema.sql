ALTER TABLE payments RENAME payment_method_id TO gateway_method_id;
ALTER TABLE payments ADD COLUMN client_reference CHARACTER VARYING(255);

UPDATE payments p SET client_reference =
(SELECT reference FROM payment_orders po WHERE p.payment_order_id = po.id);

ALTER TABLE payments ALTER client_reference SET NOT NULL;