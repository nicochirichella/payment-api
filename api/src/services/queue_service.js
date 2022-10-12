const Promise = require('bluebird');
const CancelDecisionManagerWorker = require('../../src/workers/cybersource/cancel_decision_manager_worker');
const AuthorizationReverseWorker = require('../../src/workers/cybersource/authorization_reverse_worker');
const log = require('../logger');

function paymentUpdated(payment) {
  return require('../workers/payment_updated_worker').execute(payment.get('id'), payment.get('payment_order_id'));
}

function sendIpn(paymentOrder) {
  return require('../workers/send_ipn_worker').execute(paymentOrder.get('id'));
}

function capturePayment(payment) {
  return require('../workers/capture_payment_worker').execute(payment.get('id'));
}

function cancelDecisionManagerCybersource(payment, dmRequestId) {
  const cancelDecisionManagerWorker = new CancelDecisionManagerWorker(payment.get('id'), { dmRequestId });
  setTimeout(() => {
    cancelDecisionManagerWorker.execute().catch((err) => {
      log.error('services.queue_service.cancel_decision_manager_worker', {
        error_code: err.code,
        payment_id: payment.get('id'),
        reference: payment.get('client_reference'),
      });
      throw err;
    });
  }, 3000);
  return Promise.resolve();
}

function authorizationReverseCybersource(payment) {
  const authorizationReverseWorker = new AuthorizationReverseWorker(payment.id);
  setTimeout(() => {
    authorizationReverseWorker.execute().catch((err) => {
        log.error('services.queue_service.authorization_reverse_worker', {
          error_code: err.code,
          payment_id: payment.get('id'),
          reference: payment.get('client_reference'),
        });
      });
  }, 3000);
  return Promise.resolve();
}

module.exports = {
  paymentUpdated,
  sendIpn,
  capturePayment,
  cancelDecisionManagerCybersource,
  authorizationReverseCybersource,
};
