const _ = require('lodash');
const PaymentOrder = require('../models/payment_order');
const logger = require('../logger');
const queueService = require('../services/queue_service');
const PaymentStatus = require('../models/constants/payment_status');


function capturePayments(po, log) {
  const pm = po.related('paymentMethod');
  const capturedStates = [PaymentStatus.pendingCapture, PaymentStatus.successful];

  return pm.shouldCapturePayments(po)
    .then((res) => {
      if (res) {
        return po.capture()
          .catch((err) => {
            if (err.name === 'InvalidStateChangeError' && _.contains(capturedStates, err.context.fromState)) {
              log.debug('worker.payment_updated.send_capture_payment_order.already_captured', {
                err,
              });

              return Promise.resolve();
            }

            log.info('worker.payment_updated.send_capture_payment_order.send_error', {
              err,
            });

            return Promise.reject(err);
          });
      }
      return Promise.resolve();
    });
}

function paymentUpdatedWorker(paymentId, paymentOrderId) {
  let log = logger.child({
    payment_order_id: paymentOrderId,
    updated_payment_id: paymentId,
  });

  return PaymentOrder.forge({
    id: paymentOrderId,
  })
    .fetch({ withRelated: ['paymentMethod', 'payments'] })
    .then((po) => {
      if (!po) {
        log.error('worker.payment_updated.fetch_payment_order.failed');
        throw new Error(`Error fetching payment order id ${paymentOrderId}`);
      }

      log = logger.child({
        reference: po.get('reference'),
      });

      return po;
    })
    .then((po) => {
      return po.updateStatus()
        .then(() => po);
    })
    .then((po) => {
      return queueService.sendIpn(po)
        .then(() => po)
        .catch((err) => {
          log.info('worker.payment_updated.send_ipn_event.send_failed', {
            error: err,
          });
          throw err;
        });
    })
    .then(po => capturePayments(po, log).then(() => po))
    .then((po) => {
      const pm = po.related('paymentMethod');
      return pm.cancelPaymentOrderIfFailed(po);
    });
}

module.exports = {
  execute: paymentUpdatedWorker,
};
