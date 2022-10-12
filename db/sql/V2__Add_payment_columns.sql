-- Table Buyers
CREATE TABLE "public"."buyers" (
    "id" integer NOT NULL,
    "external_reference" varchar(255),
    "type" varchar(100),
    "name" varchar(100) NOT NULL,
    "gender" char,
    "birth_date" date,
    "document_number" varchar(50) NOT NULL,
    "document_type" varchar(15) NOT NULL,
    "email" varchar(100) NOT NULL,
    "phone" varchar(50) NOT NULL,
    "ip_address" varchar(16),
    "billing_city" varchar(100),
    "billing_district" varchar(100),
    "billing_country" varchar(50),
    "billing_complement" varchar(255),
    "billing_number" varchar(50),
    "billing_street" varchar(255),
    "billing_state" varchar(100),
    "billing_zip_code" varchar(50),
    "shipping_city" varchar(100),
    "shipping_district" varchar(100),
    "shipping_country" varchar(50),
    "shipping_complement" varchar(255),
    "shipping_number" varchar(50),
    "shipping_street" varchar(255),
    "shipping_state" varchar(100),
    "shipping_zip_code" varchar(50),
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("id")
);



-- Modifying table Payments
ALTER TABLE "public"."payments" ADD COLUMN "client_reference" varchar(150),
    ADD COLUMN "gateway_reference" varchar(150),
    ADD COLUMN "payment_method_id" integer NOT NULL,
    ADD COLUMN "installments" smallint,
    ADD COLUMN "status_id" integer NOT NULL,
    ADD COLUMN "buyer_id" integer NOT NULL,
    ADD COLUMN "total" money NOT NULL;
ALTER TABLE "public"."payments" ADD FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;


-- Adding table Items
CREATE TABLE "public"."items" (
    "id" integer NOT NULL,
    "name" varchar(255) NOT NULL,
    "external_reference" varchar(255),
    "discount" money NOT NULL,
    "total" money NOT NULL,
    "unit_cost" money NOT NULL,
    "quantity" integer NOT NULL,
    "payment_id" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("id"),
    FOREIGN KEY ("payment_id") REFERENCES "public"."payments" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT
);


--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: trocafone
--
CREATE SEQUENCE items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: trocafone
--
ALTER TABLE ONLY items ALTER COLUMN id SET DEFAULT nextval('items_id_seq'::regclass);


--
-- Name: buyers_id_seq; Type: SEQUENCE; Schema: public; Owner: trocafone
--
CREATE SEQUENCE buyers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: id; Type: DEFAULT; Schema: public; Owner: trocafone
--
ALTER TABLE ONLY buyers ALTER COLUMN id SET DEFAULT nextval('buyers_id_seq'::regclass);

