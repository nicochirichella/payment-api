CREATE TABLE payment_order_status_history (
  id               INTEGER     NOT NULL,
  status_id        VARCHAR(30) NOT NULL,
  payment_order_id INTEGER     NOT NULL,
  date             TIMESTAMP   NOT NULL,
  CONSTRAINT fk_payment_order_status_history_payments FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders (id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT fk_payment_order_status_history_payment_statuses FOREIGN KEY (status_id) REFERENCES public.payment_statuses (id) ON UPDATE NO ACTION ON DELETE NO ACTION NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE SEQUENCE payment_order_status_history_id_seq
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

ALTER SEQUENCE payment_order_status_history_id_seq OWNED BY payment_order_status_history.id;
ALTER TABLE ONLY payment_order_status_history
  ALTER COLUMN id SET DEFAULT nextval('payment_order_status_history_id_seq' :: REGCLASS);
ALTER TABLE ONLY payment_order_status_history
  ADD CONSTRAINT payment_order_status_history_pkey PRIMARY KEY (id);

CREATE OR REPLACE FUNCTION payment_order_status_history_log() RETURNS trigger AS $payment_order_status_history_log$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO payment_order_status_history (status_id, payment_order_id, date)
  VALUES (NEW.status_id, NEW.id, NOW());

  RETURN NEW;
END;
$payment_order_status_history_log$ LANGUAGE plpgsql;

CREATE TRIGGER payment_order_status_history
AFTER INSERT OR UPDATE ON payment_orders
FOR EACH ROW
EXECUTE PROCEDURE payment_order_status_history_log();
