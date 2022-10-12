const _ = require('lodash');
const PaymentStatus = require('../constants/payment_status');
const log = require('../../logger');
const PaymentType = require('../constants/payment_type');
const Promise = require('bluebird');
const EncryptionTypeToGatewayMethodMapper = require('../../mappers/encryption_type_to_gateway_method_mapper');
const errors = require('../../errors');

const statusesPriority = [
  // initial statuses
  PaymentStatus.creating,

  // creation failed
  PaymentStatus.rejected,
  PaymentStatus.error,

  // cancellation
  PaymentStatus.pendingCancel, // internal
  PaymentStatus.cancelled,

  // authorization
  PaymentStatus.pendingAuthorize, // internal
  PaymentStatus.authorized,

  // unsuccessful statuses
  PaymentStatus.chargedBack,
  PaymentStatus.refunded,

  PaymentStatus.partialRefund,
  PaymentStatus.inMediation,

  // capture
  PaymentStatus.pendingCapture,
  PaymentStatus.successful,
];

function validatePayments(payments, paymentOrderId) {
  if (payments.length !== 2) {
    log.info('payment_method.two_credit_cards.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'two credit cards needs exactly two payments',
    });
    return Promise.reject(new Error('twoCreditCards needs exactly two payments'));
  }

  if (payments[0].type !== PaymentType.creditCard || payments[1].type !== PaymentType.creditCard) {
    log.info('payment_method.one_credit_card.create_payments.error', {
      payment_order_id: paymentOrderId,
      message: 'payment must be of type creditCard but found other type',
      paymentTypes: _.map(payments, (p) => {
        return p.type;
      }),
    });
    return Promise.reject(new Error('twoCreditCard acepts only creditCard type'));
  }

  return Promise.resolve();
}


function calculateStatus(paymentOrder) {
  return paymentOrder.getRelation('validPayments')
    .then((payments) => {
      const baseCaseReduce = { status: PaymentStatus.creating, value: 99 };
      return payments
        .map(p => p.get('status_id'))
        .map((s) => {
          return ({ status: s, value: _.indexOf(statusesPriority, s) });
        })
        .reduce((res, s) => ((res.value < s.value) ? res : s), baseCaseReduce)
        .status;
    });
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
  type: 'TWO_CREDIT_CARDS',

  validatePayments,
  calculateStatus,
  getGivenByClientGatewayMethods,
};
