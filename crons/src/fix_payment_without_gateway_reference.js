//Usar variables de entorno
var Promise = require('bluebird');
var rp = require('request-promise');
const log = require('./logger');

var dbConfig = {
    client: 'postgres',
    connection: {
        host     : 'prd-microservices-database.trocafone.net',
        user     : process.env['DB_USER'],
        password : process.env['DB_PSWD'],
        database : 'payment_api',
    }
};

var knex = require('knex')(dbConfig);

const CYBERSOURCE_TYPE = 'CYBERSOURCE_CC';
const TENANT_EC_BR = 1;

function getMercadoPagoReference(tenant, reference) {
    const mercadoPagoAccessToken = tenant === TENANT_EC_BR ?
        process.env['MERCADOPAGO_ACCESS_TOKEN'] : process.env['MERCADOPAGO_TV_ACCESS_TOKEN'];

    const options = {
        method: 'GET',
        rejectUnauthorized: false,
        uri: 'https://api.mercadopago.com/v1/payments/search?collector.id=me',
        qs: {
            'access_token': mercadoPagoAccessToken,
            'external_reference': reference
        },
        headers: {
            'Content-Type': 'application/json'
        },
        insecure: true
    };

    return rp(options)
        .then(function (resp){
            const resp_body = JSON.parse(resp);
            return resp_body.results[0].id;
        });
}

function getGatewayReference(clientReference, gatewayMethodType, tenant) {
    if(gatewayMethodType === CYBERSOURCE_TYPE) {
        return Promise.resolve(clientReference);
    }

    return getMercadoPagoReference(tenant, clientReference)
        .catch((e) => {
            log.warning('payment_without_gateway_reference.mercadopago_request_fail', {
               client_reference: clientReference,
               error: e
            });
            return Promise.reject(e);
        });
}

knex.select(knex.raw('payments.client_reference, gateway_methods.tenant_id, gateway_methods.type as gm_type'))
    .from('payments')
    .innerJoin('gateway_methods','gateway_methods.id','payments.gateway_method_id')
    .whereNull('payments.retried_with_payment_id')
    .whereNull('payments.gateway_reference')
    .whereNotIn('payments.status_id',['error','creating'])
    .whereNot('payments.type','totvs')
    .whereRaw('payments.created_at <= now() - interval \'1 minutes\'')
    .then((results) => {
        log.info('payment_without_gateway_reference.fixing_payments', {
            number_of_results: results.length
        });
        return Promise.each(results, function (payment, index){
            log.info('payment_without_gateway_reference.starting_to_fix_status', {
                client_reference: payment.client_reference
            });

            return getGatewayReference(payment.client_reference, payment.gm_type, payment.tenant_id)
                .then((gatewayReference) => {
                    log.info('payment_without_gateway_reference.updating_gateway_reference', {
                        client_reference: payment.client_reference,
                        gateway_reference: gatewayReference
                    });
                    return knex('payments')
                        .where('payments.client_reference', payment.client_reference)
                        .update('gateway_reference', gatewayReference)
                        .catch((e) => {
                            log.error('payment_without_gateway_reference.updating_gateway_reference_error', {
                                client_reference: payment.client_reference,
                                error: e
                            });
                        });
                })
                .catch((e) => {
                    log.error('payment_without_gateway_reference.get_gateway_reference_error', {
                        client_reference: payment.client_reference,
                        error: e
                    });
                });
        });
    })
    .catch(e => log.warn('General error', { error: e }))
    .then(() => process.exit());