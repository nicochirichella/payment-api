--INSTRUCTIONS TO ADD ONE (OR MANY) NEW ENTITIES:

-- 1. If adding a tenant, do it in a different init_script file under this folder.

-- 2. If adding a new gateway, just put the insert statement under gateways.

-- 3. If adding a new gateway_method, create a new variable in the DECLARE statement, then add the
--    insert statement under gateway_methods, followed by RETURNING id INTO <<variable>>. Remember that
--    the tenant_id property should be the tenantId variable. Don't forget to add the interest_rates
--    for that gateway_method.

-- 4. If adding a new payment_method, add the insert statement under gateway_methods. Remember that
--    the tenant_id property should be the tenantId variable, and the gateway_method_id should be the
--    variable that holds the id of the gateway_method you want to associate to your new payment_method.


--This code repairs the ids sequences in case they got out of sync.
LOCK TABLE tenants IN EXCLUSIVE MODE;
LOCK TABLE gateways IN EXCLUSIVE MODE;
LOCK TABLE gateway_methods IN EXCLUSIVE MODE;
LOCK TABLE payment_methods IN EXCLUSIVE MODE;
LOCK TABLE interest_rates IN EXCLUSIVE MODE;
SELECT setval('tenants_id_seq', COALESCE((SELECT MAX(id)+1 FROM tenants), 1), false);
SELECT setval('gateways_id_seq', COALESCE((SELECT MAX(id)+1 FROM gateways), 1), false);
SELECT setval('gateway_methods_id_seq', COALESCE((SELECT MAX(id)+1 FROM gateway_methods), 1), false);
SELECT setval('payment_methods_id_seq', COALESCE((SELECT MAX(id)+1 FROM payment_methods), 1), false);
SELECT setval('interest_rates_id_seq', COALESCE((SELECT MAX(id)+1 FROM interest_rates), 1), false);
COMMIT;

--INSTRUCTIONS TO ADD ONE (OR MANY) NEW ENTITIES:

-- 1. If adding a tenant, do it in a different init_script file under this folder.

-- 2. If adding a new gateway, just put the insert statement under gateways.

-- 3. If adding a new gateway_method, create a new variable in the DECLARE statement, then add the
--    insert statement under gateway_methods, followed by RETURNING id INTO <<variable>>. Remember that
--    the tenant_id property should be the tenantId variable. Don't forget to add the interest_rates
--    for that gateway_method.

-- 4. If adding a new payment_method, add the insert statement under gateway_methods. Remember that
--    the tenant_id property should be the tenantId variable, and the gateway_method_id should be the
--    variable that holds the id of the gateway_method you want to associate to your new payment_method.


--This code repairs the ids sequences in case they got out of sync.
LOCK TABLE tenants IN EXCLUSIVE MODE;
LOCK TABLE gateways IN EXCLUSIVE MODE;
LOCK TABLE gateway_methods IN EXCLUSIVE MODE;
LOCK TABLE payment_methods IN EXCLUSIVE MODE;
LOCK TABLE interest_rates IN EXCLUSIVE MODE;
SELECT setval('tenants_id_seq', COALESCE((SELECT MAX(id)+1 FROM tenants), 1), false);
SELECT setval('gateways_id_seq', COALESCE((SELECT MAX(id)+1 FROM gateways), 1), false);
SELECT setval('gateway_methods_id_seq', COALESCE((SELECT MAX(id)+1 FROM gateway_methods), 1), false);
SELECT setval('payment_methods_id_seq', COALESCE((SELECT MAX(id)+1 FROM payment_methods), 1), false);
SELECT setval('interest_rates_id_seq', COALESCE((SELECT MAX(id)+1 FROM interest_rates), 1), false);
COMMIT;


DO $$
DECLARE
    tenantId integer;
    adyenGatewayMethodId integer;
    mercadopago_cc_GatewayMethodId integer;
    mercadopago_ticket_GatewayMethodId integer;
    paypal_GatewayMethodId integer;
    paypal_cc_GatewayMethodId integer;
    totvs_GatewayMethodId integer;
    cybersource_cc_GatewayMethodId integer;

BEGIN

    -- TENANTS

    INSERT INTO tenants (name, api_key, ipn_url)
	VALUES ('ec_br_pombo', '6a304be0-a3cd-4dad-8363-0aae14bcdf52', 'https://pombo.stg.trocafone.net/notifications/ipn')
	RETURNING id INTO tenantId;

	-- GATEWAYS

	INSERT INTO gateways ( tenant_id, type, name, base_url, keys, created_at, updated_at) VALUES (tenantId,  'ADYEN', 'Adyen', 'https://pal-test.adyen.com/pal/servlet/Payment/v12/', '{ "basic": {"username": "ws@Company.Trocafone", "password": "8CVm2Tb%n~+uA<Pcq%tswC^5t" }, "merchantAccount": "TrocafoneBR" }', now(), now());
    INSERT INTO gateways ( tenant_id, type, name, base_url, keys, created_at, updated_at) VALUES (tenantId,  'PAYPAL', 'Paypal', 'https://api.sandbox.paypal.com/v1/', '{"walletSecrets":{"clientId":"ASYOOUfapg_IhhEx7Ukqbl75AY4T5M26H940esdnni1qvGgUpMk8LK5t4vQW6L5dP7D-0F3781u3xopW","clientSecret":"EBW6Ugzz3xyvPV3N2oGEvNY2NxMN9DYGmf5L5KBSL02P8XmjLZvse2Q_1QAL9r6fRk32jW-K4mm0Jr3_","merchantId":"D3ZP6AYF3ALML"},"ccSecrets":{"clientId":"AeELFZCOwQT118bmTj9G3CE-VQtHlcu7xe51ESY7StFP23CJio3niV3eweJ1Z-TnJ5x2EfDwRXq0E2b2","clientSecret":"EPhrc2MneWZtJCbn_QqTU6X5ZOK3SOmeRZSlJSI1ntz0wh0Gj9DQtPDp2fCvY6M9mk86-2jNscMVXxMU","merchantId":"8MCTNH8R4Z382"},"checkoutUrl":"https://staging.trocafone.com/comprar/checkout","refreshTokenUrl":"https://api.sandbox.paypal.com/v1/oauth2/token"}', now(), now());
    INSERT INTO gateways ( tenant_id, type, name, base_url, keys, created_at, updated_at) VALUES (tenantId,  'MERCADOPAGO', 'Mercadopago', 'https://api.mercadopago.com/v1/', '{ "accessToken": "APP_USR-1741271916019417-082810-96572e513aaf64826f68dddc691fe7b9__LD_LA__-185370551", "publicKey": "APP_USR-3812525c-f74b-4b2e-9c76-e83dc3949013", "ticketPaymentMethodId":"bolbradesco" }', now(), now());
    INSERT INTO gateways ( tenant_id, type, name, base_url, keys, created_at, updated_at) VALUES (tenantId,  'CYBERSOURCE', 'Cybersource', 'https://ics2wstest.ic3.com/commerce/1.x/', '{"secretKey": "dde4c2d42c2d43fca0ce22633477c15f70942114d7434cf6a51d02e395682a5100aa377948764bf28aca887ba68db30a0cd2e923d9aa4112aa0f42968b9806d1867cd566d50e4c768a5e4eea1025435f69b09f8f095841b4803c91bbb6d0f7825097be79eba94cf6847d6b3729829370c9158c69deea4987926522208a1b727e"}', now(), now());

	--GATEWAY_METHODS

    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'ADYEN_CC', 'Credit Card Adyen', true, now(), now(), 1440, true, null, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/multiple-credit-cards-stg/index.html?v=3&tenant=ec_br_pombo&paymentMethod=TWO_CREDIT_CARDS&numberofpayments=2&environment=staging&formatter=adyen', null);
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'ADYEN_CC', 'Credit Card Adyen', true, now(), now(), 1440, true, null, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/one-credit-card-stg/index.html?v=10&tenant=ec_br_pombo&paymentMethod=ONE_CREDIT_CARD&environment=staging&formatter=adyen', null) RETURNING id INTO adyenGatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'MERCADOPAGO_CC', 'Credit Card MP', true, now(), now(), 1440, true, null, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/one-credit-card-stg/index.html?v=10&tenant=ec_br_pombo&paymentMethod=ONE_CREDIT_CARD&environment=staging&formatter=mercadopago', null) RETURNING id INTO mercadopago_cc_GatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'MERCADOPAGO_CC', 'Credit Card MP', true, now(), now(), 1440, true, null, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/multiple-credit-cards-stg/index.html?v=3&tenant=ec_br_pombo&paymentMethod=TWO_CREDIT_CARDS&numberofpayments=2&environment=staging&formatter=mercadopago', null);
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'MERCADOPAGO_TICKET', 'Ticket', true, now(), now(), 10080, true, null, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/ticket-stg/index.html?paymentMethod=TICKET&tenant=ec_br_pombo&environment=staging&language=pt', null) RETURNING id INTO mercadopago_ticket_GatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'PAYPAL', 'Paypal', true, now(), now(), 4320, true, 30, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/paypal/index.html?paymentMethod=PAYPAL&tenant=ec_br_pombo&environment=staging&language=pt&v=3', null) RETURNING id INTO paypal_GatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'PAYPAL_CC', 'Paypal Credit Card', true, now(), now(), 4320, true, 30, null, null) RETURNING id INTO paypal_cc_GatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'TOTVS', 'Totvs', true, now(), now(), 1000, true, null, null, null) RETURNING id INTO totvs_GatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl, ui_url, payment_method_id) VALUES (tenantId, 'CYBERSOURCE_CC', 'CyberSource Credit Card', true, now() , now() , 1440, true, null, 'https://s3.amazonaws.com/payment-frontend.trocafone.com/one-credit-card-stg/index.html?v=10&tenant=ec_br_pombo&paymentMethod=ONE_CREDIT_CARD&environment=staging&formatter=cybersource', null) RETURNING id INTO cybersource_cc_GatewayMethodId;

    -- PAYMENT_METHODS

    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, mercadopago_cc_GatewayMethodId, 'Two credit cards', 'TWO_CREDIT_CARDS', null, true, now(), now());
    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, paypal_GatewayMethodId, 'Paypal', 'PAYPAL', null, true, now(), now());
    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, paypal_cc_GatewayMethodId, 'One credit card', 'ONE_CREDIT_CARD', null, true, now(), now());
    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, mercadopago_ticket_GatewayMethodId, 'Ticket', 'TICKET', null, true, now(), now());
    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, totvs_GatewayMethodId, 'Totvs', 'TOTVS', null, false, now(), now());

    --INTEREST RATE

    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (1,  0.00 , adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (2,  0.00 , adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (3,  0.00 , adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (4,  6.30 , adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (5,  7.59 , adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (6,  8.89 , adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (7,  10.20, adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (8,  11.52, adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (9,  12.85, adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (10, 14.19, adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (11, 12.79, adyenGatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (12, 16.91, adyenGatewayMethodId, now(), now(), null);

    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (1,  0.00 , mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (2,  0.00 , mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (3,  0.00 , mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (4,  6.30 , mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (5,  7.59 , mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (6,  8.89 , mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (7,  10.20, mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (8,  11.52, mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (9,  12.85, mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (10, 14.19, mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (11, 12.79, mercadopago_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (12, 16.91, mercadopago_cc_GatewayMethodId, now(), now(), null);

    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (1,  0.00 , mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (2,  0.00 , mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (3,  0.00 , mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (4,  6.30 , mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (5,  7.59 , mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (6,  8.89 , mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (7,  10.20, mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (8,  11.52, mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (9,  12.85, mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (10, 14.19, mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (11, 12.79, mercadopago_ticket_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (12, 16.91, mercadopago_ticket_GatewayMethodId, now(), now(), null);

    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (1,  0.00 , paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (2,  0.00 , paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (3,  0.00 , paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (4,  6.30 , paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (5,  7.59 , paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (6,  8.89 , paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (7,  10.20, paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (8,  11.52, paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (9,  12.85, paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (10, 14.19, paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (11, 12.79, paypal_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (12, 16.91, paypal_GatewayMethodId, now(), now(), null);

    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (1,  0.00 , paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (2,  0.00 , paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (3,  0.00 , paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (4,  6.30 , paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (5,  7.59 , paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (6,  8.89 , paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (7,  10.20, paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (8,  11.52, paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (9,  12.85, paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (10, 14.19, paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (11, 12.79, paypal_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (12, 16.91, paypal_cc_GatewayMethodId, now(), now(), null);

    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (1,  0.00 , cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (2,  0.00 , cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (3,  0.00 , cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (4,  6.30 , cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (5,  7.59 , cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (6,  8.89 , cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (7,  10.20, cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (8,  11.52, cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (9,  12.85, cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (10, 14.19, cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (11, 12.79, cybersource_cc_GatewayMethodId, now(), now(), null);
    INSERT INTO interest_rates (amount, interest, gateway_method_id, created_at, updated_at, deleted_at) VALUES (12, 16.91, cybersource_cc_GatewayMethodId, now(), now(), null);


	--
END $$;

