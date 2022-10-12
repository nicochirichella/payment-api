ALTER TABLE payment_methods RENAME TO gateway_methods;
ALTER TABLE gateway_methods DROP COLUMN settings;
ALTER TABLE gateway_methods DROP COLUMN ui_url;
ALTER SEQUENCE payment_methods_id_seq RENAME TO gateway_methods_id_seq;

CREATE SEQUENCE payment_methods_id_seq;
CREATE SEQUENCE payment_orders_id_seq;

CREATE TABLE payment_methods (
  id                INTEGER PRIMARY KEY         NOT NULL DEFAULT nextval('payment_methods_id_seq' :: REGCLASS),
  tenant_id         INTEGER                     NOT NULL,
  gateway_method_id INTEGER                     NOT NULL,
  name              CHARACTER VARYING(255)      NOT NULL,
  type              CHARACTER VARYING(255)      NOT NULL,
  ui_url            CHARACTER VARYING(255)      NOT NULL,
  enabled           BOOL                        NOT NULL,
  created_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),

  FOREIGN KEY (gateway_method_id) REFERENCES gateway_methods (id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT
);

INSERT INTO payment_methods (tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (1, 4, 'One credit card', 'ONE_CREDIT_CARD', '', TRUE, now(), now());
INSERT INTO payment_methods (tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (2, 4, 'One credit card', 'ONE_CREDIT_CARD', '', TRUE, now(), now());

CREATE TABLE payment_orders (
  id                 INTEGER PRIMARY KEY         NOT NULL DEFAULT nextval('payment_orders_id_seq' :: REGCLASS),
  purchase_reference CHARACTER VARYING(255)      NOT NULL,
  reference          CHARACTER VARYING(255)      NOT NULL,
  payment_method_id  INTEGER                     NOT NULL,
  buyer_id           INTEGER                     NOT NULL,
  total              NUMERIC(12, 2)              NOT NULL,
  currency           CHARACTER VARYING(3)        NOT NULL,
  status_id          CHARACTER VARYING(30)       NOT NULL,
  tenant_id          INTEGER                     NOT NULL,
  created_at         TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),

  FOREIGN KEY (buyer_id) REFERENCES public.buyers (id)
  MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods (id)
  MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (status_id) REFERENCES public.payment_statuses (id)
  MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id) REFERENCES public.tenants (id)
  MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX purchase_reference_index ON payment_orders USING BTREE (purchase_reference);

INSERT INTO payment_orders
(
  id,
  purchase_reference,
  reference,
  payment_method_id,
  buyer_id,
  total,
  currency,
  status_id,
  tenant_id,
  created_at,
  updated_at
)
SELECT
  id,
  client_order_reference,
  client_payment_reference,
  tenant_id, -- It's a hack. Because in a few lines before we are creating the payment_methods, we can assure that it will be exactly equal to the tenant id because of the order of the creation
  buyer_id,
  total,
  currency,
  status_id,
  tenant_id,
  created_at,
  updated_at
FROM payments;

ALTER TABLE payments ADD COLUMN payment_order_id INTEGER;
UPDATE payments SET payment_order_id = id;
CREATE INDEX payment_payment_order_id_index ON payments USING BTREE (payment_order_id);

ALTER TABLE payments DROP COLUMN client_order_reference;
ALTER TABLE payments DROP COLUMN client_payment_reference;
ALTER TABLE payments DROP COLUMN buyer_id;
ALTER TABLE payments DROP COLUMN tenant_id;
ALTER TABLE payments RENAME COLUMN total TO amount;

INSERT INTO payment_statuses (id, description, created_at, updated_at) VALUES ('creating', '', now(), now());
INSERT INTO payment_statuses (id, description, created_at, updated_at) VALUES ('error', '', now(), now());
