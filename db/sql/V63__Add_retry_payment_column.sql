ALTER TABLE public.payments ADD COLUMN "retry_payment_id" bigint;
ALTER TABLE public.payments ADD FOREIGN KEY ("retry_payment_id") REFERENCES public.payments ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX payments_retry_payment_id_index ON payments USING BTREE (retry_payment_id);