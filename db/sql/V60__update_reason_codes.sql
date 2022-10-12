update payments
SET status_detail= CASE
                     WHEN status_detail = 'not_authorized' then 'rejected_by_bank'
                     WHEN status_detail = 'inactive_or_not_authorized_card' then 'rejected_by_bank'
                     WHEN status_detail = 'payment_processor_timeout' THEN 'gateway_error'
                     WHEN status_detail = 'by_merchant' and gateway_method_id = g.id THEN 'manual_fraud'
                     WHEN status_detail = 'fraud' and gateway_method_id = g.id THEN 'automatic_fraud'
                     ELSE status_detail
END
FROM gateway_methods g
where g.type = 'CYBERSOURCE_CC';