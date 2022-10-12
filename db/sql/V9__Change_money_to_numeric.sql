ALTER TABLE "public"."items" ALTER COLUMN "discount" TYPE numeric(12,2),
	ALTER COLUMN "total" TYPE numeric(12,2),
	ALTER COLUMN "unit_cost" TYPE numeric(12,2);

ALTER TABLE "public"."payments" ALTER COLUMN "total" TYPE numeric(12,2);