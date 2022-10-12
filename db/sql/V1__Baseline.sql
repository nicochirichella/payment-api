--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: trocafone; Tablespace:
--
CREATE TABLE payment_methods (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    type character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    ui_url character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: trocafone
--
CREATE SEQUENCE payment_methods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: trocafone
--
ALTER SEQUENCE payment_methods_id_seq OWNED BY payment_methods.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: trocafone; Tablespace:
--
CREATE TABLE payments (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: trocafone
--
CREATE SEQUENCE payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: trocafone
--
ALTER SEQUENCE payments_id_seq OWNED BY payments.id;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: trocafone; Tablespace:
--
CREATE TABLE tenants (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    api_key character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: trocafone
--
CREATE SEQUENCE tenants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: trocafone
--
ALTER SEQUENCE tenants_id_seq OWNED BY tenants.id;


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: trocafone
--
ALTER TABLE ONLY tenants ALTER COLUMN id SET DEFAULT nextval('tenants_id_seq'::regclass);

--
-- Name: id; Type: DEFAULT; Schema: public; Owner: trocafone
--
ALTER TABLE ONLY payments ALTER COLUMN id SET DEFAULT nextval('payments_id_seq'::regclass);

--
-- Name: id; Type: DEFAULT; Schema: public; Owner: trocafone
--
ALTER TABLE ONLY payment_methods ALTER COLUMN id SET DEFAULT nextval('payment_methods_id_seq'::regclass);

--
-- Name: payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: trocafone; Tablespace:
--
ALTER TABLE ONLY payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);

--
-- Name: payments_pkey; Type: CONSTRAINT; Schema: public; Owner: trocafone; Tablespace:
--
ALTER TABLE ONLY payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: trocafone; Tablespace:
--
ALTER TABLE ONLY tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

-- Foregin key from payment_methods to tenant
ALTER TABLE "public"."payment_methods" ADD FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;
