ALTER TABLE payments ADD COLUMN tenant_id INTEGER ;
ALTER TABLE payments ADD CONSTRAINT payment_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT;

UPDATE payments p SET tenant_id =
(SELECT tenant_id FROM payment_orders po WHERE p.payment_order_id = po.id);

ALTER TABLE payments ALTER tenant_id SET NOT NULL;

DROP INDEX purchase_reference_index;

CREATE UNIQUE INDEX reference_tenant_id_index ON payment_orders (reference, tenant_id);
CREATE UNIQUE INDEX client_reference_tenant_id_index ON payments (client_reference, tenant_id);