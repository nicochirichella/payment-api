SELECT SETVAL('payment_orders_id_seq', COALESCE(MAX(id), 1) ) FROM payment_orders;
