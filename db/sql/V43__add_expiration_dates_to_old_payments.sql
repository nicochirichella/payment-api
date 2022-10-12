UPDATE PAYMENTS SET expiration_date = created_at + interval '2 days' WHERE created_at < TIMESTAMP '2016-09-12T18:09-03:00';
UPDATE PAYMENTS SET expiration_date = created_at + interval '30 minutes' WHERE created_at >= TIMESTAMP '2016-09-12T18:09-03:00' AND created_at < TIMESTAMP '2016-09-19T12:03-03:00';
UPDATE PAYMENTS SET expiration_date = created_at + interval '2 days' WHERE created_at >= TIMESTAMP '2016-09-19T12:03-03:00' AND created_at < TIMESTAMP '2016-09-19T12:04-03:00';
UPDATE PAYMENTS SET expiration_date = created_at + interval '30 minutes' WHERE created_at >= TIMESTAMP '2016-09-19T12:04-03:00' AND created_at < TIMESTAMP '2016-10-24T16:18-03:00';
UPDATE PAYMENTS SET expiration_date = created_at + interval '180 minutes' WHERE created_at >= TIMESTAMP '2016-10-24T12:04-03:00' AND created_at < TIMESTAMP '2016-10-24T17:16-03:00';
UPDATE PAYMENTS SET expiration_date = created_at + interval '1 days' WHERE created_at >= TIMESTAMP '2016-10-24T17:16-03:00';
ALTER TABLE payments ALTER COLUMN expiration_date SET NOT NULL;
