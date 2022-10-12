CREATE OR REPLACE FUNCTION payment_status_history_log() RETURNS trigger AS $payment_status_history_log$
    BEGIN
        IF TG_OP = 'UPDATE' THEN
            IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
                RETURN NEW;
            END IF;
        END IF;

        INSERT INTO payment_status_history (status_id, payment_id, date)
        VALUES (NEW.status_id, NEW.id, NOW());

        RETURN NEW;
    END;
$payment_status_history_log$ LANGUAGE plpgsql;

CREATE TRIGGER payment_status_history
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE PROCEDURE payment_status_history_log();
