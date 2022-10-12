const log = require('./logger');
const rp = require('request-promise');

function getOptions(url, gatewayReference) {
    var options = {
        method: 'POST',
        uri: url,
        rejectUnauthorized: false,
        body: 'content=%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%0A%3C\\!DOCTYPE%20CaseManagementOrderStatus%20SYSTEM%20%22https%3A%2F%2Febc.cybersource.com%2Febc%2Freports%2Fdtd%2Fcmorderstatus_1_1.dtd%22%3E%0A%0A%3CCaseManagementOrderStatus%20xmlns%3D%22http%3A%2F%2Freports.cybersource.com%2Freports%2Fcmos%2F1.0%22%20MerchantID%3D%22trocafone_br%22%20Name%3D%22Case%20Management%20Order%20Status%22%20Date%3D%222020-04-28%2002%3A47%3A43%20GMT%22%20Version%3D%221.1%22%3E%0A%20%20%3CUpdate%20MerchantReferenceNumber%3D%22' +
                gatewayReference + '%22%20RequestID%3D%225880420506056636004058%22%3E%0A%20%20%20%20%3COriginalDecision%3EREVIEW%3C%2FOriginalDecision%3E%0A%20%20%20%20%3CNewDecision%3EACCEPT%3C%2FNewDecision%3E%0A%20%20%20%20%3CReviewer%3Edm_api%3C%2FReviewer%3E%0A%20%20%20%20%3CQueue%3ERevis%C3%A3o%20Manual%3C%2FQueue%3E%0A%20%20%20%20%3CProfile%3EValor%20%26lt%3B%20R%24%20600%2C00%3C%2FProfile%3E%0A%20%20%3C%2FUpdate%3E%0A%3C%2FCaseManagementOrderStatus%3E%0A%0A&undefined=',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        insecure: true,
    };

    return options;
}

async function manual_review_approval(payment) {
    const url ='https://payment-trocafone-internal.trocafone.net/ec_br/v1/gateways/CYBERSOURCE/ipn';
    let options = getOptions(url, payment.gateway_reference);

    log.info('cybersource_ipn.starting_to_send_ipn', { gateway_reference: payment.gateway_reference });

    return rp(options)
        .then(function (parsedBody) {
            console.log(parsedBody);
        })
        .catch((err) => {
            log.error('cybersource_ipn.send_ipn_fail', {
                gateway_reference: payment.gateway_reference,
                url
            });
            throw err;
        });
}

module.exports = { manual_review_approval };