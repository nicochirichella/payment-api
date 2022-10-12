const _ = require('lodash');
const log = require('../../logger');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentStatus = require('../constants/payment_status.js');
const PaymentType = require('../constants/payment_type.js');
const PaymentStatusDetail = require('../constants/payment_status_detail');
const GatewayMethodActionType = require('../constants/gateway_method_action_type.js');

function validatePayment(requestData) {
  return new Promise((resolve, reject) => {
    if (_.get(requestData, 'type') !== PaymentType.paypal) {
      return reject(new errors.BadRequest(`Wrong payment type: ${requestData.type}. Expected ${PaymentType.paypal}`));
    }

    if (_.get(requestData, 'paymentInformation') !== null) {
      return reject(new errors.BadRequest('Payment information should be sent null.'));
    }

    return resolve();
  });
}

function cancelPayment(payment) {
  const self = this;
  const nonRefundableStatuses = [PaymentStatus.pendingClientAction, PaymentStatus.creating];
  return payment.history()
    .then((h) => {
      const lastStatus = h[h.length - 2];
      const notExecuted = _.contains(h, PaymentStatus.pendingExecute);
      const notRefundable = !_.contains(nonRefundableStatuses, lastStatus);

      if (notExecuted && notRefundable) {
        log.debug('payment_cancel.payment_will_be_refunded', { client_reference: payment.get('client_reference') });
        return self.gateway.refundPayment(payment);
      }

      if (lastStatus === PaymentStatus.pendingClientAction && payment.get('status_detail') !== PaymentStatusDetail.ok) {
        log.debug(
          'payment_cancel.pending_client_action_was_cancelled_and_will_be_marked_as_rejected',
          {
            client_reference: payment.get('client_reference'),
          },
        );
        return self.gateway.cancelPayment(payment).then((p) => {
          p.set('status_id', PaymentStatus.rejected);
          return p.save();
        });
      }
      log.debug('payment_cancel.payment_will_be_cancelled', { client_reference: payment.get('client_reference') });
      return self.gateway.cancelPayment(payment).then((p) => {
        p.set('status_id', PaymentStatus.cancelled);
        return p.save();
      });
    });
}

function capturePayment(payment) {
  return this.gateway.capturePayment(payment);
}

function executePayment(payment, metadata) {
  return this.gateway.executePayment(payment, metadata).then((executeData) => {
    const newMetadata = payment.get('metadata') ? payment.get('metadata') : {};
    newMetadata.saleId = executeData.saleId;
    newMetadata.payerId = metadata.payerId;
    payment.set('metadata', newMetadata);
    payment.set('installments', executeData.installments);
    payment.set('status_id', executeData.status);
    payment.set('status_detail', executeData.statusDetail);
    return payment.save();
  });
}

function chargeBackPayment() {
  return Promise.resolve();
}

// Overrides default interest validation behaviour
function validateInterest(paymentData) {
  if (paymentData.installments !== null) {
    return Promise.reject(new errors.InvalidAmountOfInstallments(paymentData.installments, this.get('name')));
  }

  if ((paymentData.interestInCents || 0) !== 0) {
    const err = new Error();
    err.status = 400;
    err.code = 'gateway_methods.paypal.interest_must_be_zero';
    this.message = 'Interest must be zero in Paypal gateway.';
    this.devMessage = `Expected interestInCents: ${paymentData.interestInCents} to be zero`;
    return Promise.reject(err);
  }

  return Promise.resolve();
}

function cancelManualRevisionPayment(payment, externalRevisionReference) {
  return Promise.resolve();
}

function postIpnProcessAction(payment, ipnData, resolvedStatuses) {
  return Promise.resolve();
}

module.exports = {
  type: 'PAYPAL',
  gatewayType: 'PAYPAL',
  gatewayMethodActionType: GatewayMethodActionType.redirect,

  cancelPayment,
  chargeBackPayment,
  capturePayment,
  validatePayment,
  executePayment,
  validateInterest,
  cancelManualRevisionPayment,
  postIpnProcessAction,
};
