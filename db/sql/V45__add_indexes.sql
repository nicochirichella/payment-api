CREATE INDEX payment_methods_gateway_method_id_index ON payment_methods USING BTREE (gateway_method_id);
CREATE INDEX items_payment_order_id_index ON items USING BTREE (payment_order_id);
CREATE INDEX gateway_methods_tenant_id_index ON gateway_methods USING BTREE (tenant_id);
CREATE INDEX payment_status_history_payment_id_index ON payment_status_history USING BTREE (payment_id);

ALTER TABLE "public"."interest_rates" ADD CONSTRAINT "interest_rates_pkey" UNIQUE ("id");
ALTER TABLE "public"."interest_rates_history" ADD CONSTRAINT "interest_rates_history_pkey" UNIQUE ("id");
