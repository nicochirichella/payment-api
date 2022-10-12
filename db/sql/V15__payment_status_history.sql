CREATE TABLE payment_status_history (
	"id" integer NOT NULL,
	"status_id" varchar(30) NOT NULL COLLATE "default",
	"payment_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	CONSTRAINT "fk_payment_status_history_payments" FOREIGN KEY ("payment_id") REFERENCES "public"."payments" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE INITIALLY IMMEDIATE,
	CONSTRAINT "fk_payment_status_history_payment_statuses" FOREIGN KEY ("status_id") REFERENCES "public"."payment_statuses" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE SEQUENCE payment_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE payment_status_history_id_seq OWNED BY payment_status_history.id;

ALTER TABLE ONLY payment_status_history ALTER COLUMN id SET DEFAULT nextval('payment_status_history_id_seq'::regclass);

ALTER TABLE ONLY payment_status_history ADD CONSTRAINT payment_status_history_pkey PRIMARY KEY (id);