const PaymentOrder = require('../models/payment_order');
const logger = require('../logger');
const ipnService = require('../services/ipn_send');

function sendIpnWorker(paymentOrderId) {
  let log = logger.child({
    payment_order_id: paymentOrderId,
  });

  return PaymentOrder.forge({
    id: paymentOrderId,
  })
    .fetch()
    .then((po) => {
      if (!po) {
        log.error('worker.send_ipn.fetch_payment_order.failed');
        throw new Error(`Error fetching payment order id ${paymentOrderId}`);
      }

      log = log.child({
        reference: po.get('reference'),
      });

      return po;
    })
    .then((po) => {
      return ipnService.send(po)
        .tap(() => {
          log.info('worker.send_ipn.propagating_ipn.send_success');
        })
        .catch((err) => {
          log.info('worker.send_ipn.propagating_ipn.send_failed', {
            error: err,
          });
          throw err;
        });
    });
}

module.exports = {
  execute: sendIpnWorker,
};
