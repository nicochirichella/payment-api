const _ = require('lodash');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentType = require('../constants/payment_type.js');
const GatewayMethodActionType = require('../constants/gateway_method_action_type.js');

function capturePayment(payment) {
  return this.gateway.capturePayment(payment);
}

function cancelPayment() {
  return Promise.reject(new Error('Not implemented'));
}

function executePayment(payment) {
  return Promise.reject(new Error('Not implemented'));
}

function validatePayment(requestData) {
  return new Promise((resolve, reject) => {
    if (_.get(requestData, 'type') !== PaymentType.totvs) {
      return reject(new errors.BadRequest(`Wrong payment type: ${requestData.type}. Expected ${PaymentType.totvs}`));
    }
    return resolve();
  });
}

function chargeBackPayment(payment) {
  return Promise.reject(new Error('Not implemented'));
}

function cancelManualRevisionPayment(payment, externalRevisionReference) {
  return Promise.resolve();
}

function postIpnProcessAction(payment, ipnData, resolvedStatuses) {
  return Promise.resolve();
}

module.exports = {
  type: 'TOTVS',
  gatewayType: 'TOTVS',
  gatewayMethodActionType: GatewayMethodActionType.status,

  chargeBackPayment,
  validatePayment,
  executePayment,
  capturePayment,
  cancelPayment,
  cancelManualRevisionPayment,
  postIpnProcessAction,
};
