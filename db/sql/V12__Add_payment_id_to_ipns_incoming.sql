ALTER TABLE "public"."incoming_ipns" ADD COLUMN "payment_id" int4;
ALTER TABLE "public"."incoming_ipns" ADD FOREIGN KEY ("payment_id") REFERENCES "public"."payments" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;
