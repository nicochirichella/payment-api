CREATE TABLE payment_statuses (
    id character varying(30) NOT NULL,
    description character varying(255) NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY payment_statuses ADD CONSTRAINT payment_statuses_pkey PRIMARY KEY (id);

INSERT INTO payment_statuses (id, description) VALUES ('successful', '');
INSERT INTO payment_statuses (id, description) VALUES ('rejected', '');
INSERT INTO payment_statuses (id, description) VALUES ('chargedBack', '');
INSERT INTO payment_statuses (id, description) VALUES ('pending', '');
INSERT INTO payment_statuses (id, description) VALUES ('refunded', '');
INSERT INTO payment_statuses (id, description) VALUES ('cancelled', '');
INSERT INTO payment_statuses (id, description) VALUES ('partialRefund', '');
INSERT INTO payment_statuses (id, description) VALUES ('inMediation', '');

ALTER TABLE "public"."payments" DROP COLUMN "status_id";
ALTER TABLE "public"."payments" ADD COLUMN "status_id" character varying(30) NOT NULL;

ALTER TABLE "public"."payments" ADD FOREIGN KEY ("status_id") REFERENCES "public"."payment_statuses" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;