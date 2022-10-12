const _ = require('lodash');
const PaymentStatus = require('../constants/payment_status');
const log = require('../../logger');
const PaymentType = require('../constants/payment_type');
const Promise = require('bluebird');
const EncryptionTypeToGatewayMethodMapper = require('../../mappers/encryption_type_to_gateway_method_mapper');
const errors = require('../../errors');

function calculateStatus(paymentOrder) {
  return paymentOrder.getRelation('validPayments')
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
    log.info('payment_method.one_credit_card.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'one credit card only accepts one payment',
    });
    return Promise.reject(new Error('oneCreditCard only accepts one payment'));
  }

  if (payments[0].type !== PaymentType.creditCard) {
    log.info('payment_method.one_credit_card.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'payment must be of type creditCard but found other type',
      paymentTypes: _.map(payments, (p) => {
        return p.type;
      }),
    });
    return Promise.reject(new Error('oneCreditCard acepts only creditCard type'));
  }

  return Promise.resolve();
}

function getGivenByClientGatewayMethods(paymentData) {
  const encryptions = _.get(paymentData, 'encryptedCreditCards');

  if (!_.isArray(encryptions)) {
    throw new errors.InvalidEncryptionTypes();
  }

  const mapper = new EncryptionTypeToGatewayMethodMapper();
  const gatewayMethodTypes = encryptions.reduce((gmTypes, encryptedCreditCard) => {
    const gmType = mapper.getGatewayMethodType(encryptedCreditCard.encryptionType);
    if (gmType) {
      gmTypes.push(gmType);
    }
    return gmTypes;
  }, []);

  if (gatewayMethodTypes.length === 0) {
    throw new errors.InvalidEncryptionTypes();
  }

  return gatewayMethodTypes;
}

module.exports = {
  type: 'ONE_CREDIT_CARD',

  validatePayments,
  calculateStatus,
  getGivenByClientGatewayMethods,
};
