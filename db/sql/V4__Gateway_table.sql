CREATE TABLE gateways (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    type character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    base_url character varying(255) NOT NULL,
    keys JSON NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE gateways_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE gateways_id_seq OWNED BY gateways.id;

ALTER TABLE "public"."gateways" ADD CONSTRAINT "gateways_type_tenant_id_unique" UNIQUE ("tenant_id","type");

ALTER TABLE ONLY gateways ALTER COLUMN id SET DEFAULT nextval('gateways_id_seq'::regclass);

ALTER TABLE ONLY gateways ADD CONSTRAINT gateways_pkey PRIMARY KEY (id);

ALTER TABLE "public"."gateways" ADD FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;
