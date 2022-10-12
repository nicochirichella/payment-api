const _ = require('lodash');
const Payment = require('../models/payment');
const logger = require('../logger');
const PaymentStatus = require('../models/constants/payment_status');

const ACCEPTABLE_INVALID_STATUS_CHANGE = [
  PaymentStatus.successful,
  PaymentStatus.pendingCapture,
];

function capturePaymentWorker(paymentId) {
  let log = logger.child({
    payment_id: paymentId,
  });

  return Payment.forge({
    id: paymentId,
  })
    .fetch({ withRelated: ['gatewayMethod'] })
    .then((p) => {
      if (!p) {
        log.error('worker.capture_payment.fetch_payment.failed');
        throw new Error(`Error fetching payment id ${paymentId}`);
      }

      log = log.child({
        client_reference: p.get('client_reference'),
      });

      return p;
    })
    .then((p) => {
      return p.capture()
        .tap(() => log.info('worker.capture_payment.capture.success'))
        .catch((err) => {
          if (err.name === 'InvalidStateChangeError' && _.contains(ACCEPTABLE_INVALID_STATUS_CHANGE, err.context.fromState)) {
            log.debug('worker.capture_payment.capture.already_sent_capture');
            return;
          }

          log.info('worker.capture_payment.capture.failed', {
            error: err,
          });

          throw err;
        });
    });
}

module.exports = {
  execute: capturePaymentWorker,
};
