-- Table FailedIpns
CREATE TABLE "public"."failed_ipns" (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    gateway_id integer NOT NULL,
    client_payment_reference varchar(150),
    message varchar(255),
    payload JSON NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE failed_ipns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE failed_ipns_id_seq OWNED BY failed_ipns.id;

ALTER TABLE ONLY failed_ipns ALTER COLUMN id SET DEFAULT nextval('failed_ipns_id_seq'::regclass);

ALTER TABLE ONLY failed_ipns ADD CONSTRAINT failed_ipns_pkey PRIMARY KEY (id);

ALTER TABLE "public"."failed_ipns" ADD FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."failed_ipns" ADD FOREIGN KEY ("gateway_id") REFERENCES "public"."gateways" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;