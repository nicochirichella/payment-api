ALTER TABLE "public"."payments" ADD COLUMN tenant_id integer NOT NULL;

ALTER TABLE "public"."payments" ADD FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;