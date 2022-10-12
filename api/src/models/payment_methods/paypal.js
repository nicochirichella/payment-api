/**
 * Created by javieranselmi on 10/12/17.
 */

const _ = require('lodash');
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
    log.info('payment_method.paypal.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'paypal only accepts one payment',
    });
    return Promise.reject(new Error('paypal only accepts one payment'));
  }

  if (payments[0].type !== PaymentType.paypal) {
    log.info('payment_method.paypal.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'payment must be of type paypal but found other type',
      paymentTypes: _.map(payments, (p) => {
        return p.type;
      }),
    });
    return Promise.reject(new Error('paypal accepts only paypal type'));
  }

  return Promise.resolve();
}

module.exports = {
  type: 'PAYPAL',

  validatePayments,
  calculateStatus,
};
