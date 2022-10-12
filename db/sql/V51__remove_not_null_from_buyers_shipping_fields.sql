ALTER TABLE public.buyers ALTER COLUMN shipping_city DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_district DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_country DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_complement DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_number DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_street DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_state DROP NOT NULL;
ALTER TABLE public.buyers ALTER COLUMN shipping_zip_code DROP NOT NULL;