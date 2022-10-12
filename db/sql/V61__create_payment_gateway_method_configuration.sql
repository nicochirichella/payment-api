-- Adding table payment_gateway_configuration
CREATE TABLE "public"."payment_method_gateway_methods_configuration" (
    "id" bigserial NOT NULL,
    "payment_method_id" bigint NOT NULL,
    "gateway_method_id" bigint NOT NULL,
    "gateway_method_order" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp,
    PRIMARY KEY ("id"),
    FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
    FOREIGN KEY ("gateway_method_id") REFERENCES "public"."gateway_methods" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT
);
