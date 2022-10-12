//Usar variables de entorno
var Promise = require('bluebird');
const log = require('./logger');
const mercadoPagoIPN = require('./mercadopago_ipn');

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

const MAX_IPNS = 10;

knex.select(knex.raw('payments.gateway_reference, gateway_methods.tenant_id, count(*) as ipns_quant'))
    .from('payments')
    .innerJoin('gateway_methods','gateway_methods.id','payments.gateway_method_id')
    .innerJoin('incoming_ipns','incoming_ipns.payment_id','payments.id')
    .whereNull('payments.retried_with_payment_id')
    .andWhere('payments.status_id','pendingCancel')
    .whereRaw('payments.updated_at <= now() - interval \'1 hours\'')
    .groupBy('payments.gateway_reference','gateway_methods.tenant_id')
    .then((results) => {
        log.info('payment_pending_cancel.fixing_payments', {
            number_of_results: results.length
        });
        return Promise.each(results, function (payment, index) {
            log.info('payment_pending_cancel.starting_to_cancel', {
                gateway_reference: payment.gateway_reference,
                ipns_quant: payment.ipns_quant
            });

            if (payment.ipns_quant >= MAX_IPNS) {
                log.info('payment_pending_cancel.max_ipn_attempts_has_been_reached', {
                    gateway_reference: payment.gateway_reference
                });
                return;
            }

            return mercadoPagoIPN.sendIpn(payment)
                .then(function () {
                    log.info("payment_pending_cancel.ipn_correctly_sent", {
                        gateway_reference: payment.gateway_reference });
                })
                .catch(function (err) {
                    log.error("payment_pending_cancel.error_sending_ipn", {
                        gateway_reference: payment.gateway_reference,
                        error: err });
                });
        });
    })
    .catch(e => log.warn('General error', { error: e }))
    .then(() => process.exit());