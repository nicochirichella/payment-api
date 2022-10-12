INSERT INTO payment_statuses (id, description) VALUES ('pendingCapture', '');
UPDATE payment_status_history SET status_id = 'pendingCapture' WHERE status_id ='pending';
UPDATE payments SET status_id = 'pendingCapture' WHERE status_id ='pending';
UPDATE incoming_ipns SET process_status = 'pendingCapture' where process_status = 'pending';
DELETE FROM payment_statuses WHERE id ='pending';