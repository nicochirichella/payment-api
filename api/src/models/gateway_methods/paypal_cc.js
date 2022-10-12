/**
 * Created by javieranselmi on 10/12/17.
 */

const _ = require('lodash');
const log = require('../../logger');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentStatus = require('../constants/payment_status.js');
const PaymentType = require('../constants/payment_type.js');
const GatewayMethodActionType = require('../constants/gateway_method_action_type.js');

function validatePayment(requestData) {
  return new Promise((resolve, reject) => {
    if (_.get(requestData, 'type') !== PaymentType.creditCard) {
      return reject(new errors.BadRequest(`Wrong payment type: ${requestData.type}. Expected ${PaymentType.creditCard}`));
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

      if (lastStatus === PaymentStatus.pendingClientAction && payment.hasRejections()) {
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
    payment.set('status_id', executeData.status);
    payment.set('status_detail', executeData.statusDetail);
    return payment.save();
  });
}

function chargeBackPayment() {
  return Promise.resolve();
}

function createRejection(payment, reason) {
  const gateway = this.gateway;
  if (payment.get('status_id') !== PaymentStatus.pendingClientAction) {
    return Promise.reject(new errors.InvalidActionForCurrentPaymentStatus(payment.get('status_id'), 'create_rejection'));
  }
  return gateway.doStatusTranslation(gateway.statusDetailsMap, reason).then((statusDetail) => {
    const newMetadata = payment.get('metadata') ? payment.get('metadata') : {};
    newMetadata.rejections = newMetadata.rejections ? newMetadata.rejections : [];
    newMetadata.rejections.push({
      created_at: new Date(),
      reason,
      status_detail: statusDetail,
    });
    payment.set('status_detail', statusDetail);
    payment.set('metadata', newMetadata);
    return payment.save();
  });
}

function cancelManualRevisionPayment(payment, externalRevisionReference) {
  return Promise.resolve();
}

function postIpnProcessAction(payment, ipnData, resolvedStatuses) {
  return Promise.resolve();
}

module.exports = {
  type: 'PAYPAL_CC',
  gatewayType: 'PAYPAL',
  gatewayMethodActionType: GatewayMethodActionType.redirect,

  cancelPayment,
  chargeBackPayment,
  capturePayment,
  validatePayment,
  executePayment,
  createRejection,
  cancelManualRevisionPayment,
  postIpnProcessAction,
};
