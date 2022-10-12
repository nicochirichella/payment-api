const _ = require('lodash');
const errors = require('../../errors');
const Promise = require('bluebird');
const PaymentType = require('../constants/payment_type.js');
const GatewayMethodActionType = require('../constants/gateway_method_action_type.js');
const PaymentStatus = require('../constants/payment_status');
const Queue = require('../../services/queue_service');
const log = require('../../logger');
const moment = require('moment');
const helpers = require('../../lib/helpers');
const EncryptionType = require('../constants/encryption_type');

function capturePayment(payment) {
  return this.gateway.capturePayment(payment)
    .tap((response) => {
      const newMetadata = payment.get('metadata') ? payment.get('metadata') : {};
      newMetadata.captureRequestId = _.get(response, 'result.requestID');
      newMetadata.captureTimestamp = _.get(response, 'result.ccCaptureReply.requestDateTime');
      payment.set('metadata', newMetadata);
    });
}

function cancelManualRevisionPayment(payment, options) {
  return this.gateway.manuallyRejectCase(payment, {}, options).then((response) => {
      return response;
    });
}

function voidPayment(payment) {
  return this.gateway.voidPayment(payment)
    .tap(() => {
      // We perform an auth reversal because just voided the capture but the auth is still in effect.
      return this.gateway.authorizationReversePayment(payment, PaymentStatus.refunded)
        .catch((err) => {
          // Reversal failure shouldn't stop the flow.
          log.error('payment_cancel.authorization_reversal_failed', { client_reference: payment.get('client_reference') });
        });
    }).then(() => {
      payment.set('status_id', PaymentStatus.refunded);
      return payment.save();
    })
    .catch((err) => {
      log.info('payment_cancel.payment_will_be_credited_on_void_fail', { client_reference: payment.get('client_reference') });
      return this.creditPayment(payment);
    });
}

function creditPayment(payment) {
  return this.gateway.creditPayment(payment).then(() => {
    payment.set('status_id', PaymentStatus.refunded);
    return payment.save();
  });
}

function authorizationReversePayment(payment, targetStatus) {
  return this.gateway.authorizationReversePayment(payment).then(() => {
    payment.set('status_id', targetStatus);
    return payment.save();
  });
}

function cancelPayment(payment) {
  const capturedAt = moment(payment.get('metadata').captureTimestamp).utc();
  const capturedLessThan24HoursAgo = moment.duration(moment.utc().diff(capturedAt)).asHours() < 24;

  return payment.history()
    .then((h) => {
      if (_.contains(h, PaymentStatus.successful)) {
        if (capturedLessThan24HoursAgo) {
          log.info('payment_cancel.payment_will_be_voided', { client_reference: payment.get('client_reference') });
          return this.voidPayment(payment);
        }

        log.info('payment_cancel.payment_will_be_credited', { client_reference: payment.get('client_reference') });
        return this.creditPayment(payment);
      }

      log.info('payment_cancel.payment_will_be_cancelled', { client_reference: payment.get('client_reference') });
      return this.authorizationReversePayment(payment, PaymentStatus.cancelled);
    });
}

function executePayment(payment) {
  return Promise.reject(new Error('Not implemented'));
}


function validatePayment(requestData) {
  return new Promise((resolve, reject) => {
    if (_.get(requestData, 'type') !== PaymentType.creditCard) {
      return reject(new errors.BadRequest(`Wrong payment type: ${requestData.type}. Expected ${PaymentType.creditCard}`));
    }

    if (!helpers.getEncryptedToken(requestData, EncryptionType.cybersource)) {
      return reject(new errors.BadRequest('No credit card set in additionalInfo'));
    }

    return resolve();
  });
}

function chargeBackPayment(payment) {
  return this.gateway.chargeBackPayment(payment).then(() => {
    return payment;
  });
}

function postSendAction(payment) {
  if (payment.get('status_id') === PaymentStatus.authorized) {
    return this.queue.paymentUpdated(payment);
  }
  return Promise.resolve();
}

function postIpnProcessAction(payment, ipnData, resolvedStatuses, originalStatus) {
  const ipnResolvesToRejected = resolvedStatuses.status === PaymentStatus.rejected;
  const paymentWasAlreadyInRejected = originalStatus === PaymentStatus.rejected;

  if (ipnResolvesToRejected && !paymentWasAlreadyInRejected ) {
    return this.queue.authorizationReverseCybersource(payment);
  }
  return Promise.resolve();
}



module.exports = {
  type: 'CYBERSOURCE_CC',
  gatewayType: 'CYBERSOURCE',
  gatewayMethodActionType: GatewayMethodActionType.status,
  queue: Queue,
  chargeBackPayment,
  validatePayment,
  executePayment,
  capturePayment,
  cancelPayment,
  postSendAction,
  creditPayment,
  voidPayment,
  authorizationReversePayment,
  cancelManualRevisionPayment,
  postIpnProcessAction,
};
