ALTER TABLE public.payments ADD COLUMN "retried_with_payment_id" bigint;
ALTER TABLE public.payments ADD FOREIGN KEY ("retried_with_payment_id") REFERENCES public.payments ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX payments_retried_with_payment_id_index ON payments USING BTREE (retried_with_payment_id);
