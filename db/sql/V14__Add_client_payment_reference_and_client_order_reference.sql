ALTER TABLE "public"."payments" RENAME COLUMN "client_reference" TO "client_order_reference";
ALTER TABLE "public"."payments" ADD COLUMN "client_payment_reference" varchar(150);
ALTER TABLE "public"."payments" ADD UNIQUE ("client_payment_reference");

UPDATE "public"."payments" SET "client_payment_reference" = "client_order_reference" || '-' || "id";

ALTER TABLE "public"."payments" ALTER COLUMN "client_payment_reference" SET NOT NULL;