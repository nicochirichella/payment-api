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
BEGIN;
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

DO $$
DECLARE
    tenantId integer;
    mercadopago_cc_GatewayMethodId integer;
    mercadopago_ticket_GatewayMethodId integer;

BEGIN

    -- TENANTS

    INSERT INTO tenants (name, api_key, ipn_url)
    VALUES ('tv_br', '289e14fb-01da-430a-bffa-a09d85715f07', 'https://staging.trocafone.com/notifications/ipn')
    RETURNING id INTO tenantId;

    -- GATEWAYS

    INSERT INTO gateways ( tenant_id, type, name, base_url, keys, created_at, updated_at) VALUES (tenantId,  'MERCADOPAGO', 'Mercadopago', 'https://api.mercadopago.com/v1/', '{ "accessToken": "TEST-8719440538396965-040413-10b888873b5c1ec090136fe2e3a898b3-312077229", "publicKey": "TEST-9c453017-5e77-4d05-ad7b-fe7aa14fed34", "ticketPaymentMethodId":"bolbradesco" }', now(), now());

    --GATEWAY_METHODS

    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl) VALUES (tenantId, 'MERCADOPAGO_CC', 'Credit Card MP', true, now() , now() , 1440, true, null) RETURNING id INTO mercadopago_cc_GatewayMethodId;
    INSERT INTO gateway_methods (tenant_id, type, name, enabled, created_at, updated_at, post_execute_ttl, payment_ttl_include_weekends, pre_execute_ttl) VALUES (tenantId, 'MERCADOPAGO_TICKET', 'Ticket', true, now() , now() , 10080, true, null) RETURNING id INTO mercadopago_ticket_GatewayMethodId;

    -- PAYMENT_METHODS

    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, mercadopago_cc_GatewayMethodId, 'One credit card', 'ONE_CREDIT_CARD', 'https://s3.amazonaws.com/payment-frontend.trocafone.com/one-credit-card-stg/index.html?v=10&tenant=tv_br&paymentMethod=ONE_CREDIT_CARD&environment=staging&formatter=mercadopago', true, now(), now());
    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, mercadopago_cc_GatewayMethodId, 'Two credit cards', 'TWO_CREDIT_CARDS', 'https://s3.amazonaws.com/payment-frontend.trocafone.com/multiple-credit-cards-stg/index.html?v=3&tenant=tv_br&paymentMethod=TWO_CREDIT_CARDS&numberofpayments=2&environment=staging&formatter=mercadopago', true, now(), now());
    INSERT INTO payment_methods ( tenant_id, gateway_method_id, name, type, ui_url, enabled, created_at, updated_at) VALUES (tenantId, mercadopago_ticket_GatewayMethodId, 'Ticket', 'TICKET', 'https://s3.amazonaws.com/payment-frontend.trocafone.com/ticket-stg/index.html?paymentMethod=TICKET&tenant=ec_br&environment=staging&language=pt', true, now(), now());

    --INTEREST RATE

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

    --
END $$;
COMMIT ;
