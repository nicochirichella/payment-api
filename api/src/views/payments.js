const moment = require('moment');
const Promise = require('bluebird');

function mapPayments(payment) {
  return payment.getRelation('gatewayMethod')
    .then((gatewayMethod) => {
      return {
        id: payment.get('id').toString(),
        gatewayReference: payment.get('gateway_reference'),
        clientReference: payment.get('client_reference'),
        status: payment.statusName(),
        type: payment.get('type'),
        statusDetail: payment.get('status_detail'),
        createdAt: moment(payment.get('created_at')).utc().format(),
        updatedAt: moment(payment.get('updated_at')).utc().format(),
        gatewayMethod: gatewayMethod.get('type'),
        installments: payment.get('installments') ? payment.get('installments') : null,
        paymentInformation: payment.get('payment_information') ? payment.get('payment_information') : null,
        amountInCents: parseInt(Math.round(payment.get('amount') * 100), 10),
        interestInCents: parseInt(Math.round(payment.get('interest') * 100), 10),
        retriedWithPaymentId: payment.get('retried_with_payment_id') ? payment.get('retried_with_payment_id').toString() : null,
      };
    });
}

module.exports = (payments) => {
  return Promise.all(payments.map(mapPayments));
};
