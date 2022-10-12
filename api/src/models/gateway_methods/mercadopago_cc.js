const _ = require('lodash');
const log = require('../../logger');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentStatus = require('../constants/payment_status.js');
const PaymentType = require('../constants/payment_type.js');
const GatewayMethodActionType = require('../constants/gateway_method_action_type.js');
const helpers = require('../../lib/helpers');
const EncryptionType = require('../constants/encryption_type');

function validatePayment(requestData) {
  return new Promise((resolve, reject) => {
    if (_.get(requestData, 'type') !== PaymentType.creditCard) {
      return reject(new errors.BadRequest(`Wrong payment type: ${requestData.type}`));
    }

    if (!helpers.getEncryptedToken(requestData, EncryptionType.mercadopago)) {
      return reject(new errors.BadRequest('No credit card set in additionalInfo'));
    }

    if (!_.get(requestData, 'paymentInformation.processor')) {
      return reject(new errors.BadRequest('No MercadoPago payment_method_id'));
    }

    return resolve();
  });
}

function cancelPayment(payment) {
  const self = this;

  return payment.history()
    .then((h) => {
      if (_.contains(h, PaymentStatus.successful)) {
        log.debug('payment_cancel.payment_will_be_refunded', { client_reference: payment.get('client_reference') });
        return self.gateway.refundPayment(payment);
      }
      log.debug('payment_cancel.payment_will_be_cancelled', { client_reference: payment.get('client_reference') });
      return self.gateway.cancelPayment(payment);
    });
}

function capturePayment(payment) {
  return this.gateway.capturePayment(payment);
}

function chargeBackPayment() {
  return Promise.resolve();
}

function cancelManualRevisionPayment(payment, externalRevisionReference) {
  return Promise.resolve();
}

function postIpnProcessAction(payment, ipnData, resolvedStatuses) {
  return Promise.resolve();
}

module.exports = {
  type: 'MERCADOPAGO_CC',
  gatewayType: 'MERCADOPAGO',
  gatewayMethodActionType: GatewayMethodActionType.status,

  cancelPayment,
  chargeBackPayment,
  capturePayment,
  validatePayment,
  cancelManualRevisionPayment,
  postIpnProcessAction,
};
