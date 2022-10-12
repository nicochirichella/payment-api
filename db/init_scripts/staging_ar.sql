DO $$
DECLARE
    tenantId integer;
    gatewayMethodId integer;
BEGIN

    -- TENANTS

    INSERT INTO tenants (name, api_key, ipn_url)
	VALUES ('ec_ar', '75653604-50eb-455e-8606-d4da35be0433', 'https://staging.trocafone.com.ar/notifications/ipn')
	RETURNING id INTO tenantId;

	-- GATEWAYS

	INSERT INTO public.gateways (tenant_id, type, name, base_url, keys)
	VALUES (tenantId, 'ADYEN', 'Adyen', 'https://pal-test.adyen.com/pal/servlet/Payment/v12/', '{ "basic": {"username": "ws@Company.Trocafone", "password": "8CVm2Tb%n~+uA<Pcq%tswC^5t" }, "merchantAccount": "TrocafoneBR" }');

	INSERT INTO public.gateways (tenant_id, type, name, base_url, keys)
	VALUES (tenantId, 'MERCADOPAGO', 'Mercadopago', 'https://api.mercadopago.com/v1/', '{ "accessToken": "APP_USR-4928042226294909-101315-2596926a803974a23f7308425550540d__LA_LD__-194564326", "publicKey": "APP_USR-4f6151d2-a6d6-4f2e-9be2-835bf54897dd", "ticketPaymentMethodId":"bolbradesco" }');

	INSERT INTO public.gateways (tenant_id, type, name, base_url, keys)
	VALUES (tenantId, 'PAYPAL', 'Paypal', 'https://api.sandbox.paypal.com/v1/', '{ "clientId": "AZHyg91te0A10YtrSBdHMFEr9dGv5SCALlxJ_YgNYWUTzPk2ftDzZbR5Qyif99_6fX_kHna3z8YObCHe", "clientSecret":"EPRGhE7Dh-ns1EwYUMhv5ChhM3QZgqW1iPCs7qSqGh3OnsbxlleqPZKUjSaGnf56CMbl1gqijxQPk6AZ", "accessToken":"A21AAFZn4W3lvr35_xxr_QMY4iJhQNaWbg99qu2DC8wLP1AV9bi-s6zJwsLcZ-SYiFiC4o_4suLPI_EcNLfKetFO31DqR1paw", "checkoutUrl":"https://www.trocafone.local/comprar/checkout" }');


    -- PAYMENT_METHODS

	INSERT INTO public.payment_methods (tenant_id, type, name, enabled, ui_url)
	VALUES (tenantId, 'ONE_CREDIT_CARD', 'One credit card', true, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/one-credit-card-stg/index.html?v=4&tenant=ec_br&paymentMethod=ONE_CREDIT_CARD');

	INSERT INTO public.payment_methods (tenant_id, type, name, enabled, ui_url)
	VALUES (tenantId, 'TWO_CREDIT_CARDS', 'Two credit cards', true, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/two-credit-cards-stg/index.html?v=4&tenant=ec_br&paymentMethod=TWO_CREDIT_CARDS');

	INSERT INTO public.payment_methods (tenant_id, type, name, enabled, ui_url)
	VALUES (tenantId, 'TICKET', 'Ticket', true, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/ticket-stg/index.html?paymentMethod=TICKET&tenant=ec_br&environment=local');

	INSERT INTO public.payment_methods (tenant_id, type, name, enabled, ui_url)
	VALUES (tenantId, 'PAYPAL', 'Paypal', true, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/paypal-stg/index.html?paymentMethod=PAYPAL&tenant=ec_br&environment=local');

	--GATEWAY_METHODS

    INSERT INTO public.gateway_methods (tenant_id, type, name, enabled, payment_ttl, payment_ttl_include_weekends)
    VALUES (tenantId, 'ADYEN_CC', 'CREDITCARD - ADYEN', true, 2880, true);

    INSERT INTO public.gateway_methods (tenant_id, type, name, enabled, payment_ttl, payment_ttl_include_weekends)
    VALUES (tenantId, 'MERCADOPAGO_CC', 'CREDITCARD - MERCADOPAGO', true, 2880, true);

    INSERT INTO public.gateway_methods (tenant_id, type, name, enabled, payment_ttl, payment_ttl_include_weekends)
    VALUES (tenantId, 'MERCADOPAGO_TICKET', 'Ticket', true, 10080, false);

    INSERT INTO public.gateway_methods (tenant_id, type, name, enabled, payment_ttl, payment_ttl_include_weekends)
    VALUES (tenantId, 'PAYPAL', 'Paypal', true, 2880, true);

	--
END $$;