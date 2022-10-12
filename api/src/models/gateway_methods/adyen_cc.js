const _ = require('lodash');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentType = require('../constants/payment_type.js');
const GatewayMethodActionType = require('../constants/gateway_method_action_type.js');
const helpers = require('../../lib/helpers');
const EncryptionType = require('../constants/encryption_type');

function validatePayment(requestData) {
  return new Promise((resolve, reject) => {
    if (_.get(requestData, 'type') !== PaymentType.creditCard) {
      return reject(new errors.BadRequest(`Wrong payment type: ${requestData.type}`));
    }

    if (helpers.getEncryptedToken(requestData, EncryptionType.adyen)) {
      return resolve();
    }
    return reject(new errors.BadRequest('No credit card set in additionalInfo'));
  });
}

function cancelPayment(payment) {
  return this.gateway.cancelPayment(payment)
    .then((res) => {
      const meta = payment.get('metadata');
      meta.modificationPspReferences.push({
        pspReference: res.cancelRequestReference,
        action: 'cancelOrRefund',
        date: (new Date()).getTime(),
      });

      payment.set('metadata', meta);
      return res;
    });
}

function chargeBackPayment() {
  return Promise.resolve();
}

function capturePayment(payment) {
  return this.gateway.capturePayment(payment);
}

function cancelManualRevisionPayment(payment, externalRevisionReference) {
  return Promise.resolve();
}

function postIpnProcessAction(payment, ipnData, resolvedStatuses) {
  return Promise.resolve();
}

module.exports = {
  type: 'ADYEN_CC',
  gatewayType: 'ADYEN',
  gatewayMethodActionType: GatewayMethodActionType.status,

  cancelPayment,
  chargeBackPayment,
  validatePayment,
  capturePayment,
  cancelManualRevisionPayment,
  postIpnProcessAction,
};
