CREATE TABLE incoming_ipns (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    gateway_id integer NOT NULL,
    payload JSON NOT NULL,
    process_status character varying(255) NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE incoming_ipns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE incoming_ipns_id_seq OWNED BY gateways.id;

ALTER TABLE ONLY incoming_ipns ALTER COLUMN id SET DEFAULT nextval('incoming_ipns_id_seq'::regclass);

ALTER TABLE ONLY incoming_ipns ADD CONSTRAINT ipns_incoming_pkey PRIMARY KEY (id);

ALTER TABLE "public"."incoming_ipns" ADD FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."incoming_ipns" ADD FOREIGN KEY ("gateway_id") REFERENCES "public"."gateways" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;