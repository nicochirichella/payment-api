--ALTER TYPE payment_type ADD VALUE 'paypal';  <- This will be ran by hand because flyway cannot execute this statement.
INSERT INTO public.payment_statuses (id, description, created_at, updated_at) VALUES ('pendingExecute', null, now(), now());