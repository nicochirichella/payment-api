//Usar variables de entorno
var Promise = require('bluebird');
const log = require('./logger');
const mercadoPagoIPN = require('./mercadopago_ipn');
const cybersourceIPN = require('./cybersource_ipn');

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
const CYBERSOURCE_GM_ID = 15;

knex.select(knex.raw('payments.gateway_reference, gateway_methods.tenant_id, payments.gateway_method_id, count(*) as ipns_quant'))
    .from('payments')
    .innerJoin('gateway_methods','gateway_methods.id','payments.gateway_method_id')
    .innerJoin('payment_orders', 'payment_orders.id', 'payments.payment_order_id')
    .leftJoin('incoming_ipns','incoming_ipns.payment_id','payments.id')
    .whereNull('payments.retried_with_payment_id')
    .andWhere('payments.status_id','authorized')
    .whereNotIn('payment_orders.payment_method_id',[2,6])
    .whereRaw('payments.updated_at <= now() - interval \'10 minutes\'')
    .groupBy('payments.gateway_reference', 'gateway_methods.tenant_id', 'payments.gateway_method_id')
    .then((results) => {
        log.info('payment_authorized_for_long_time.fixing_payments', {
            number_of_results: results.length
        });
        return Promise.each(results, function (payment, index) {
            log.info('payment_authorized_for_long_time.starting_to_fix_status', {
                gateway_reference: payment.gateway_reference,
                ipns_quant: payment.ipns_quant
            });

            if (payment.ipns_quant >= MAX_IPNS) {
                log.info('payment_authorized_for_long_time.max_ipn_attempts_has_been_reached', {
                    gateway_reference: payment.gateway_reference
                });
                return;
            }

            let processIpn = (payment.gateway_method_id === CYBERSOURCE_GM_ID) ?
                cybersourceIPN.manual_review_approval : mercadoPagoIPN.sendIpn;

            return processIpn(payment)
                .then(function () {
                    log.info("payment_authorized_for_long_time.ipn_correctly_sent", {
                        gateway_reference: payment.gateway_reference });
                })
                .catch(function (err) {
                    log.error("payment_authorized_for_long_timex.error_sending_ipn", {
                        gateway_reference: payment.gateway_reference,
                        error: err });
                });

        });
    })
    .catch(e => log.warn('General error', { error: e }))
    .then(() => process.exit());