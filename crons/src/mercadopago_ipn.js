var rp = require('request-promise');
const log = require('./logger');

function getUrl(tenant) {
    const urls = { 1: 'https://payment-trocafone-internal.trocafone.net/ec_br/v1/gateways/MERCADOPAGO/ipn',
        2: 'https://payment-trocafone-internal.trocafone.net/tv_br/v1/gateways/MERCADOPAGO/ipn'};
    return urls[tenant];
}

function getOptions(url, gatewayReference) {
    var options = {
        method: 'POST',
        rejectUnauthorized: false,
        uri: url,
        body: {
            "data": {"id": gatewayReference},
            "type": "payment",
            "action": "payment.created"
        },
        headers: {
            'Content-Type': 'application/json'
        },
        insecure: true,
        json: true
    };

    return options;
}

function sendIpn(payment) {
    const url = getUrl(payment.tenant_id);
    if (!url) {
        log.error('mercadopago_ipn.fail_to_send_ipn.no_url_to_send_ipn', {
            gateway_reference: payment.gateway_reference
        });
        return;
    }

    const options = getOptions(url, payment.gateway_reference);
    return rp(options)
        .catch((err) => {
            log.error('mercado_pago_ipn.send_ipn_fail', {
                gateway_reference: payment.gateway_reference,
                url
            });
            throw err;
        });
}

module.exports = { sendIpn };