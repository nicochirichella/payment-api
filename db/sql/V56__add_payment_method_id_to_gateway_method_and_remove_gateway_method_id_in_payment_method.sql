ALTER TABLE public.gateway_methods ADD COLUMN payment_method_id integer;
ALTER TABLE public.gateway_methods ADD FOREIGN KEY ("payment_method_id") REFERENCES public.payment_methods ("id") ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.payment_methods ALTER COLUMN gateway_method_id DROP NOT NULL;