CREATE SEQUENCE interest_rates_id_seq;
CREATE TABLE interest_rates (
  id                INTEGER DEFAULT nextval('interest_rates_id_seq' :: REGCLASS)         NOT NULL,
  amount            INTEGER                                                              NOT NULL,
  interest          NUMERIC(4, 2)                                                        NOT NULL,
  gateway_method_id INT REFERENCES payment_api.public.gateway_methods (id)               NOT NULL,
  created_at        TIMESTAMP DEFAULT now()                                              NOT NULL,
  updated_at        TIMESTAMP DEFAULT now()                                              NOT NULL,
  deleted_at        TIMESTAMP
);

CREATE SEQUENCE interest_rates_history_id_seq;
CREATE TABLE interest_rates_history (
  id                INTEGER DEFAULT nextval('interest_rates_history_id_seq' :: REGCLASS) NOT NULL,
  amount            INTEGER                                                              NOT NULL,
  interest          NUMERIC(4, 2)                                                        NOT NULL,
  gateway_method_id INT REFERENCES payment_api.public.gateway_methods (id)               NOT NULL,
  date              TIMESTAMP DEFAULT now()                                              NOT NULL
);

CREATE INDEX interest_rates_gateway_method_id
  ON interest_rates (gateway_method_id);

CREATE FUNCTION interest_rates_history_log()
  RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
  THEN
    IF OLD.interest IS NOT DISTINCT FROM NEW.interest
    THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO interest_rates_history (amount, interest, gateway_method_id)
  VALUES (OLD.amount, OLD.interest, OLD.gateway_method_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER interest_rates_history
AFTER INSERT OR UPDATE ON interest_rates
FOR EACH ROW
EXECUTE PROCEDURE interest_rates_history_log();