DROP TRIGGER interest_rates_history ON interest_rates;
DROP FUNCTION interest_rates_history_log();

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
  VALUES (NEW.amount, NEW.interest, NEW.gateway_method_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER interest_rates_history
AFTER INSERT OR UPDATE ON interest_rates
FOR EACH ROW
EXECUTE PROCEDURE interest_rates_history_log();