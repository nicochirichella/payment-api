ALTER TABLE "public"."buyers" ADD COLUMN "billing_state_code" varchar(10);
ALTER TABLE "public"."buyers" ADD COLUMN "shipping_state_code" varchar(10);

UPDATE "public"."buyers" set billing_state_code='', shipping_state_code='';

ALTER TABLE "public"."buyers" ALTER COLUMN "billing_state_code" SET NOT NULL;
ALTER TABLE "public"."buyers" ALTER COLUMN "shipping_state_code" SET NOT NULL;