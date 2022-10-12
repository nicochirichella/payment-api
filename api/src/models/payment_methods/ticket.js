const PaymentStatus = require('../constants/payment_status');
const log = require('../../logger');
const PaymentType = require('../constants/payment_type');
const Promise = require('bluebird');

function calculateStatus(paymentOrder) {
  return paymentOrder.getRelation('payments')
    .then((payments) => {
      const p = payments.first();

      if (!p) {
        return PaymentStatus.creating;
      }

      return p.get('status_id');
    });
}

function validatePayments(payments, paymentOrderId) {
  if (payments.length !== 1) {
    log.info('payment_method.ticket.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'ticket only accepts one payment',
    });
    return Promise.reject(new Error('ticket acepts one payment'));
  }

  if (payments[0].type !== PaymentType.ticket) {
    log.info('payment_method.ticket.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: `payment must be of type ticket but found type ${payments[0].type}`,
    });
    return Promise.reject(new Error('ticket acepts only ticket type'));
  }

  return Promise.resolve();
}

module.exports = {
  type: 'TICKET',

  validatePayments,
  calculateStatus,
};
