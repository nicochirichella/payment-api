ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenant_name_unique" UNIQUE ("name"),
	ADD CONSTRAINT "tenant_api_key_unique" UNIQUE ("api_key");